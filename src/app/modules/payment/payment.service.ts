import ApiError from "../../../errors/ApiError";
import config from "../../../config";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import { verifyPaystackTransaction, createPaystackSubaccount } from "../../../helpers/paystackHelper";
import { PAYMENT_STATUS } from "../../../enum/payment";
import { NotificationService } from "../notification/notification.service";
import { Request } from "express";
import { Booking } from "../booking/booking.model";
import { Payment } from "./payment.model";
import { Service } from "../service/service.model";
import { User } from "../user/user.model";
import { BookingStateMachine } from "../booking/bookingStateMachine";
import { BOOKING_STATUS } from "../../../enum/booking";
import mongoose from "mongoose";

const handlePaymentSuccessLogic = async (bookingID: string, transactionId: string, paystackPaymentId: string) => {
  try {
    const booking = await Booking.findById(bookingID);
    if (!booking) throw new ApiError(StatusCodes.BAD_REQUEST, "Booking not found");
    if (booking.isPaid) return; // Already processed

    // Immediately mark as paid to prevent race conditions from webhook/success redirect
    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: bookingID, isPaid: false },
      {
        isPaid: true,
        transactionId: transactionId,
        paymentId: paystackPaymentId
      },
      { new: true }
    );

    if (!updatedBooking) return; // Already processed by another concurrent request

    await BookingStateMachine.transitionState(bookingID, "system", BOOKING_STATUS.REQUESTED, "Booking automatically requested to provider after successful payment");

    const serviceData = await Service.findById(booking.service).lean();
    const providerData = await User.findById(booking.provider).lean();
    const customerData = await User.findById(booking.customer).lean();

    if (!serviceData || !providerData || !customerData) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Related data not found");
    }

    // Calculations
    const amount = serviceData.price;
    const totalCommission = Number((amount * 0.18).toFixed(2)); // 18% Gross Deduction (e.g. 36 on 200)
    const gatewayFee = Number((amount * 0.03).toFixed(2)); // 3% Gateway Cost (e.g. 6 on 200) - Internal cost of platform
    const providerAmount = Number((amount - totalCommission).toFixed(2)); // 82% Net Provider (e.g. 164 on 200)

    const commonData = {
      service: booking.service,
      provider: booking.provider,
      customer: booking.customer,
      booking: booking._id,
      paymentId: paystackPaymentId,
      paymentStatus: PAYMENT_STATUS.PAID,
    };

    // Create a single payment record with full breakdown
    await Payment.create({
      ...commonData,
      amount: amount,
      gatewayFee: gatewayFee,
      platformFee: totalCommission,
      providerAmount: providerAmount,
      description: "Service payment",
    });

    // Update provider wallet and metrics
    await User.findByIdAndUpdate(booking.provider, { 
      $inc: { 
        wallet: providerAmount,
        "metrics.totalReceivedJobs": 1
      } 
    });

    // Notify provider
    await NotificationService.insertNotification({
      for: booking.provider as any,
      message: `You have a new booking request, ${customerData.name} has requested a booking for ${serviceData.category}`,
    });

  } catch (error) {
    console.error("Payment Success Error:", error);
    throw error;
  }
};

const success = async (query: any) => {
  const reference = query.reference || query.trxref || query.sessionId;
  if (!reference) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Reference / Session ID is required");
  }

  // --- Paystack Implementation ---
  const verification = await verifyPaystackTransaction(reference);
  if (!verification || !verification.status || verification.data.status !== 'success') {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment not completed or verification failed");
  }

  // Paystack metadata is stored in verification.data.metadata.custom_fields
  const customFields = verification.data.metadata?.custom_fields || [];
  const getMetaField = (key: string) => customFields.find((f: any) => f.variable_name === key)?.value;

  const serviceId = new Types.ObjectId(getMetaField('serviceId'));
  const providerId = new Types.ObjectId(getMetaField('providerId'));
  const customerId = new Types.ObjectId(getMetaField('customerId'));
  const bookingID = new Types.ObjectId(getMetaField('bookingId'));
  const transactionId = verification.data.reference;
  const paymentId = verification.data.id.toString();

  await handlePaymentSuccessLogic(bookingID.toString(), transactionId, paymentId);

  return `
    <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f4f4f4; }
                .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #4CAF50; }
                p { color: #555; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Payment Successful!</h1>
                <p>Your payment has been processed successfully. You can now close this window.</p>
            </div>
        </body>
    </html>
    `;
};

const createConnectedAccount = async (req: Request) => {
  const user = req.user;
  const userOnDB = await User.findById(user.authId || user.id);
  if (!userOnDB) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }

  // --- Paystack Implementation ---
  // Paystack creates subaccounts natively. Usually requires Bank Codes, hardcoded here as boilerplate.
  const subaccount = await createPaystackSubaccount(userOnDB.name, "044", "0690000032");

  await User.findByIdAndUpdate(userOnDB._id, { paystackAccountId: subaccount.subaccount_code });

  return `${config.backend_url}/api/v1/payment/account/${subaccount.subaccount_code}`;
};

const refreshAccount = async (req: Request) => {
  // --- Paystack Implementation ---
  return `<html><body><p>Paystack subaccounts do not require refreshing.</p></body></html>`;
};

const successAccount = async (req: Request) => {
  // --- Paystack Implementation ---
  return `
    <html>
        <body>
            <h1>Account Connected Successfully!</h1>
            <p>Your Paystack account has been linked. You can now receive payments.</p>
        </body>
    </html>
    `;
};

const webhook = async (req: Request) => {
  const event = req.body;
  
  // Paystack sends 'charge.success' when a payment is completed
  if (event.event === 'charge.success') {
    const data = event.data;
    const reference = data.reference;

    // We can reuse the same confirmation logic, but wrapped for the webhook context
    // In a production environment, you should verify the Paystack signature header here.
    const customFields = data.metadata?.custom_fields || [];
    const getMetaField = (key: string) => customFields.find((f: any) => f.variable_name === key)?.value;

    const bookingID = getMetaField('bookingId');
    if (bookingID) {
        await handlePaymentSuccessLogic(bookingID, reference, data.id.toString());
    }
  }

  return { success: true };
};

export const PaymentServices = {
  success,
  createConnectedAccount,
  refreshAccount,
  successAccount,
  webhook
};
