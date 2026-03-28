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
import { PAYMENT_STATUS, PAYMENT_TYPE, SETTLEMENT_TYPE } from '../../../enum/payment';
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

    const serviceAmount = serviceData.price;
    const gatewayFee = Number((serviceAmount * 0.03).toFixed(2));
    const platformFee = Number((serviceAmount * 0.15).toFixed(2));
    const providerAmount = Number((serviceAmount - platformFee - gatewayFee).toFixed(2));

    await Payment.create({
      paymentType: PAYMENT_TYPE.SERVICE_PAYMENT,
      paymentStatus: PAYMENT_STATUS.PAID,
      customer: booking.customer,
      provider: booking.provider,
      service: booking.service,
      booking: booking._id,
      paymentId: paystackPaymentId,
      serviceAmount,
      platformFee,
      gatewayFee,
      providerAmount,
    });

    await User.findByIdAndUpdate(booking.provider, {
      $inc: { wallet: providerAmount, 'metrics.totalReceivedJobs': 1 },
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

// Create a CANCELLATION_REFUND record when a booking is cancelled
export const createCancellationRefundRecord = async (
  bookingId: string,
  originalAmount: number,
  penaltyFee: number,
  refundedAmount: number,
  cancellationReason: string,
  customerId?: MongooseTypes.ObjectId,
  providerId?: MongooseTypes.ObjectId,
  serviceId?: MongooseTypes.ObjectId,
  providerDeduction?: number,
) => {
  return Payment.create({
    paymentType: PAYMENT_TYPE.CANCELLATION_REFUND,
    paymentStatus: refundedAmount > 0 ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.CANCELLED,
    booking: new MongooseTypes.ObjectId(bookingId),
    customer: customerId,
    provider: providerId,
    service: serviceId,
    originalAmount,
    penaltyFee,
    refundedAmount,
        cancellationReason,
        providerDeduction,
      });
    };

// Create a SETTLEMENT record when a booking is auto or manually settled
export const createSettlementRecord = async (
  bookingId: string,
  settledAmount: number,
  settlementType: SETTLEMENT_TYPE,
  providerId?: MongooseTypes.ObjectId,
  serviceId?: MongooseTypes.ObjectId,
  customerId?: MongooseTypes.ObjectId,
) => {
  return Payment.create({
    paymentType: PAYMENT_TYPE.SETTLEMENT,
    paymentStatus: PAYMENT_STATUS.AUTO_SETTLED,
    booking: new MongooseTypes.ObjectId(bookingId),
    provider: providerId,
    service: serviceId,
    customer: customerId,
    settledAmount,
    settlementType,
  });
};

// Create a DISPUTE_REFUND record when a disputed booking is refunded
export const createDisputeRefundRecord = async (
  bookingId: string,
  originalAmount: number,
  refundedAmount: number,
  disputeReason: string,
  customerId?: MongooseTypes.ObjectId,
  providerId?: MongooseTypes.ObjectId,
  serviceId?: MongooseTypes.ObjectId,
) => {
  return Payment.create({
    paymentType: PAYMENT_TYPE.DISPUTE_REFUND,
    paymentStatus: PAYMENT_STATUS.REFUNDED,
    booking: new MongooseTypes.ObjectId(bookingId),
    customer: customerId,
    provider: providerId,
    service: serviceId,
    originalAmount,
    refundedAmount,
    disputeReason,
  });
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
  await User.findByIdAndUpdate(userOnDB._id, { paystackAccountId: subaccount.subaccount_code });

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
    Payment.find({
      provider: new Types.ObjectId(userId)
    }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const walletItems = await walletQuery.modelQuery
    .populate([{ path: 'service', select: 'image category subCategory' }])
    .lean()
    .exec();

  const meta = await walletQuery.getPaginationInfo();

  const data = walletItems.map((item: any) => ({
    ...item,
    displayAmount:
      item.paymentType === PAYMENT_TYPE.SERVICE_PAYMENT
        ? item.providerAmount
        : item.paymentType === PAYMENT_TYPE.WITHDRAWAL
          ? -item.withdrawAmount
          : item.settledAmount,
  }));

  return { meta, balance: provider.wallet || 0, data };
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

  if (paymentType) {
    filterOptionsQuery.paymentType = paymentType;
  }

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

  return { meta, balance: userData.wallet, data };
};

// Get detailed information for a specific payment record
const getPaymentDetails = async (id: string) => {
  const info: any = await Payment.findById(id).populate('customer service provider').lean().exec();

  if (!info) throw new ApiError(StatusCodes.NOT_FOUND, 'Payment details not found!');

  const base = {
    customId: info.customId,
    paymentType: info.paymentType,
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

  if (info.paymentType === PAYMENT_TYPE.SERVICE_PAYMENT) {
    return {
      ...base,
      serviceAmount: info.serviceAmount,
      platformFee: info.platformFee,
      gatewayFee: info.gatewayFee,
      providerAmount: info.providerAmount,
    };
  }

  if (
    info.paymentType === PAYMENT_TYPE.CANCELLATION_REFUND ||
    info.paymentType === PAYMENT_TYPE.DISPUTE_REFUND
  ) {
    return {
      ...base,
      originalAmount: info.originalAmount,
      penaltyFee: info.penaltyFee ?? null,
      refundedAmount: info.refundedAmount,
        reason: info.cancellationReason || info.disputeReason,
        providerDeduction: info.providerDeduction ?? null,
      };
    }

  if (info.paymentType === PAYMENT_TYPE.WITHDRAWAL) {
    return {
      ...base,
      withdrawAmount: info.withdrawAmount,
      withdrawalFee: info.withdrawalFee,
      netPayout: info.netPayout,
    };
  }

  if (info.paymentType === PAYMENT_TYPE.SETTLEMENT) {
    return { ...base, settledAmount: info.settledAmount, settlementType: info.settlementType };
  }

  return base;
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

  const maxWithdrawable = (provider.wallet || 0) * 0.9;
  if (data.amount > maxWithdrawable)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Insufficient balance! You can withdraw up to ${maxWithdrawable.toFixed(2)}`,
    );

  let recipientCode = provider.paystackRecipientCode;

  if (!recipientCode) {
    const bankCode = (data.bankCode || provider.bankName || '').toString().trim();
    const accountNumber = (data.accountNumber || provider.accountNumber || '').toString().trim();

    if (!bankCode || !accountNumber) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Bank details are required for first-time withdrawal.',
      );
    }

    const recipient = await createTransferRecipient(provider.name, accountNumber, bankCode);
    recipientCode = recipient.recipient_code;

    await User.findByIdAndUpdate(provider._id, {
      paystackRecipientCode: recipientCode,
      bankName: bankCode,
      accountNumber: accountNumber,
    });
  }

  const withdrawalFee = Number((data.amount * 0.1).toFixed(2));
  const netPayout = Number((data.amount - withdrawalFee).toFixed(2));

  await initiateTransfer(netPayout, recipientCode, `Withdrawal for ${provider.name}`);

  await User.findByIdAndUpdate(provider._id, { wallet: (provider.wallet || 0) - data.amount })
    .lean()
    .exec();

  await Payment.create({
    paymentType: PAYMENT_TYPE.WITHDRAWAL,
    paymentStatus: PAYMENT_STATUS.WITHDRAWN,
    provider: provider._id,
    withdrawAmount: data.amount,
    withdrawalFee,
    netPayout,
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
