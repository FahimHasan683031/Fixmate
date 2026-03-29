// Payment Service
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import {
  verifyPaystackTransaction,
  createPaystackSubaccount,
  createTransferRecipient,
  initiateTransfer,
} from '../../../helpers/paystackHelper';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { NotificationService } from '../notification/notification.service';
import { Request } from 'express';
import { Booking } from '../booking/booking.model';
import { Payment } from './payment.model';
import { Service } from '../service/service.model';
import { User } from '../user/user.model';
import { BookingStateMachine } from '../booking/bookingStateMachine';
import { BOOKING_STATUS } from '../../../enum/booking';
import { JwtPayload } from 'jsonwebtoken';
import QueryBuilder from '../../builder/QueryBuilder';
import { IUser } from '../user/user.interface';
import { Types as MongooseTypes } from 'mongoose';
import { Transaction } from '../transaction/transaction.model';

// Handle post-payment logic: update booking, create SERVICE_PAYMENT record, notify provider
const handlePaymentSuccessLogic = async (
  bookingID: string,
  transactionId: string,
  paystackPaymentId: string,
) => {
  try {
    const booking = await Booking.findById(bookingID);
    if (!booking) throw new ApiError(StatusCodes.BAD_REQUEST, 'Booking not found');
    if (booking.isPaid) return;

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: bookingID, isPaid: false },
      { isPaid: true, transactionId: transactionId, paymentId: paystackPaymentId },
      { new: true },
    );

    if (!updatedBooking) return;

    await BookingStateMachine.transitionState(
      bookingID,
      'system',
      BOOKING_STATUS.REQUESTED,
      'Booking automatically requested to provider after successful payment',
    );

    const serviceData = await Service.findById(booking.service).lean();
    const providerData = await User.findById(booking.provider).lean();
    const customerData = await User.findById(booking.customer).lean();

    if (!serviceData || !providerData || !customerData) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Related data not found');
    }

    const servicePrice = serviceData.price;
    let vat = 0;
    if (providerData.providerDetails?.isVatRegistered) {
      vat = Number((servicePrice * 0.15).toFixed(2));
    }
    const platformFee = Number((servicePrice * 0.18).toFixed(2));
    const providerPay = Number((servicePrice * 0.82).toFixed(2));
    const paystackGatewayFee = Number((servicePrice * 0.03).toFixed(2));

    await Payment.create({
      paymentStatus: PAYMENT_STATUS.CLIENT_PAID,
      customer: booking.customer,
      provider: booking.provider,
      service: booking.service,
      booking: booking._id,
      paymentId: paystackPaymentId,
      servicePrice,
      vat,
      platformFee,
      paystackGatewayFee,
      providerPay,
    });

    await User.findByIdAndUpdate(booking.provider, {
      $inc: { 'providerDetails.wallet': providerPay, 'providerDetails.metrics.totalReceivedJobs': 1 },
    });

    await NotificationService.insertNotification({
      for: booking.provider as any,
      message: `You have a new booking request. ${customerData.name} has requested a booking for ${serviceData.category}`,
    });
  } catch (error) {
    console.error('Payment Success Error:', error);
    throw error;
  }
};

export const createCancellationRefundRecord = async (
  bookingId: string,
  refundedAmount: number,
  clientPenalty: number = 0,
  providerPenalty: number = 0,
) => {
  return Payment.findOneAndUpdate(
    { booking: new MongooseTypes.ObjectId(bookingId) },
    {
      paymentStatus: PAYMENT_STATUS.REFUNDED,
      refundAmount: refundedAmount,
      clientPenalty,
      providerPenalty,
    },
    { new: true }
  );
};

export const createSettlementRecord = async (bookingId: string) => {
  return Payment.findOneAndUpdate(
    { booking: new MongooseTypes.ObjectId(bookingId) },
    { paymentStatus: PAYMENT_STATUS.SETTLED },
    { new: true }
  );
};

export const createDisputeRefundRecord = async (
  bookingId: string,
  refundedAmount: number,
) => {
  return Payment.findOneAndUpdate(
    { booking: new MongooseTypes.ObjectId(bookingId) },
    {
      paymentStatus: PAYMENT_STATUS.REFUNDED,
      refundAmount: refundedAmount,
    },
    { new: true }
  );
};

// Process successful payment redirect from Paystack
const success = async (query: any) => {
  const reference = query.reference || query.trxref || query.sessionId;
  if (!reference) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Reference / Session ID is required');
  }

  const verification = await verifyPaystackTransaction(reference);
  if (!verification || !verification.status || verification.data.status !== 'success') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Payment not completed or verification failed');
  }

  const customFields = (verification.data as any).metadata?.custom_fields || [];
  const getMetaField = (key: string) =>
    customFields.find((f: any) => f.variable_name === key)?.value;

  const bookingID = getMetaField('bookingId');

  if (bookingID) {
    await handlePaymentSuccessLogic(
      bookingID.toString(),
      reference,
      (verification.data as any).id.toString(),
    );
  }

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

// Create a Paystack subaccount for a provider
const createConnectedAccount = async (req: Request) => {
  const user = req.user;
  const userOnDB = await User.findById(user.authId || user.id);
  if (!userOnDB) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User not found');
  }

  const subaccount = await createPaystackSubaccount(userOnDB.name, '044', '0690000032');
  await User.findByIdAndUpdate(userOnDB._id, { 'providerDetails.paystackAccountId': subaccount.subaccount_code });

  return `${config.backend_url}/api/v1/payment/account/${subaccount.subaccount_code}`;
};

// Refresh connected account (placeholder for Paystack)
const refreshAccount = async (_req: Request) => {
  return `<html><body><p>Paystack subaccounts do not require refreshing.</p></body></html>`;
};

// Return success message for account connection
const successAccount = async (_req: Request) => {
  return `
    <html>
        <body>
            <h1>Account Connected Successfully!</h1>
            <p>Your Paystack account has been linked. You can now receive payments.</p>
        </body>
    </html>
    `;
};

// Handle Paystack webhooks
const webhook = async (req: Request) => {
  const event = req.body;

  if (event.event === 'charge.success') {
    const data = event.data;
    const reference = data.reference;

    const customFields = data.metadata?.custom_fields || [];
    const getMetaField = (key: string) =>
      customFields.find((f: any) => f.variable_name === key)?.value;

    const bookingID = getMetaField('bookingId');
    if (bookingID) {
      await handlePaymentSuccessLogic(bookingID, reference, data.id.toString());
    }
  }

  return { success: true };
};

// Retrieve wallet balance and transaction history for a provider
const getWallet = async (user: JwtPayload, query: any) => {
  const userId = user.id || user.authId;
  const provider = (await User.findById(userId).lean().exec()) as IUser;
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found!');

  const walletQuery = new QueryBuilder(
    Transaction.find({ provider: new Types.ObjectId(userId) }),
    query,
  ).filter().sort().paginate().fields();

  const data = await walletQuery.modelQuery.lean().exec();
  const meta = await walletQuery.getPaginationInfo();

  return { meta, balance: provider.providerDetails?.wallet || 0, data };
};

// Retrieve filtered payment history for a user
const getPaymentHistory = async (user: JwtPayload, query: any) => {
  const { startTime, endTime, paymentType, ...rest } = query;
  const userId = user.id || user.authId;
  const userData = (await User.findById(userId).lean().exec()) as IUser;
  if (!userData) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');

  const isProvider = userData.role === 'PROVIDER';

  const filterOptionsQuery: FilterQuery<any> = {
    [isProvider ? 'provider' : 'customer']: new Types.ObjectId(userId),
  };


  if (startTime && endTime) {
    filterOptionsQuery.createdAt = { $gte: new Date(startTime), $lte: new Date(endTime) };
  }

  const historyQuery = new QueryBuilder(
    Payment.find(filterOptionsQuery).populate({
      path: 'service',
      select: 'image category subCategory',
    }),
    rest,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await historyQuery.modelQuery.lean().exec();
  const meta = await historyQuery.getPaginationInfo();

  return { meta, balance: userData.providerDetails?.wallet || 0, data };
};

// Get detailed information for a specific payment record
const getPaymentDetails = async (id: string) => {
  const info: any = await Payment.findById(id).populate('customer service provider').lean().exec();

  if (!info) throw new ApiError(StatusCodes.NOT_FOUND, 'Payment details not found!');

  const base = {
    customId: info.customId,
    paymentStatus: info.paymentStatus,
    dateAndTime: info.createdAt,
    customer: info.customer
      ? { name: info.customer.name, email: info.customer.email, address: info.customer.address }
      : null,
    provider: info.provider
      ? { name: info.provider.name, email: info.provider.email, address: info.provider.address }
      : null,
    service: info.service
      ? {
          category: info.service.category,
          subCategory: info.service.subCategory,
          price: info.service.price,
        }
      : null,
  };

  return {
    ...base,
    servicePrice: info.servicePrice,
    vat: info.vat,
    platformFee: info.platformFee,
    paystackGatewayFee: info.paystackGatewayFee,
    providerPay: info.providerPay,
    refundAmount: info.refundAmount,
  };
};

// Initiate a fund withdrawal to a bank account
const withdraw = async (
  user: JwtPayload,
  data: { amount: number; bankCode?: string; accountNumber?: string },
) => {
  const provider = (await User.findById(user.id || user.authId)
    .lean()
    .exec()) as IUser;
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found!');

  const maxWithdrawable = (provider.providerDetails?.wallet || 0) * 0.9;
  if (data.amount > maxWithdrawable)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Insufficient balance! You can withdraw up to ${maxWithdrawable.toFixed(2)}`,
    );

  let recipientCode = provider.providerDetails?.paystackRecipientCode;

  if (!recipientCode) {
    const bankCode = (data.bankCode || provider.providerDetails?.bankName || '').toString().trim();
    const accountNumber = (data.accountNumber || provider.providerDetails?.accountNumber || '').toString().trim();

    if (!bankCode || !accountNumber) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Bank details are required for first-time withdrawal.',
      );
    }

    const recipient = await createTransferRecipient(provider.name, accountNumber, bankCode);
    recipientCode = recipient.recipient_code;

    await User.findByIdAndUpdate(provider._id, {
      'providerDetails.paystackRecipientCode': recipientCode,
      'providerDetails.bankName': bankCode,
      'providerDetails.accountNumber': accountNumber,
    });
  }

  const withdrawalFee = Number((data.amount * 0.1).toFixed(2));
  const netPayout = Number((data.amount - withdrawalFee).toFixed(2));

  await initiateTransfer(netPayout, recipientCode as string, `Withdrawal for ${provider.name}`);

  await User.findByIdAndUpdate(provider._id, { 'providerDetails.wallet': (provider.providerDetails?.wallet || 0) - data.amount })
    .lean()
    .exec();

  await Transaction.create({
    type: 'WITHDRAWAL',
    provider: provider._id,
    amount: data.amount,
    fee: withdrawalFee,
    netAmount: netPayout,
    status: 'COMPLETED',
  });
};

export const PaymentServices = {
  success,
  createConnectedAccount,
  refreshAccount,
  successAccount,
  webhook,
  getWallet,
  getPaymentHistory,
  getPaymentDetails,
  withdraw,
};
