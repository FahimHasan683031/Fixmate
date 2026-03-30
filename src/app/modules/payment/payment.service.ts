// Payment Service
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import {
  createTransferRecipient,
  initiateTransfer,
} from '../../../helpers/paystackHelper';
import crypto from 'crypto';
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
import { settlePendingPenaltyDues } from '../penalty/penalty.utils';

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

    await NotificationService.insertNotification({
      for: booking.provider as any,
      message: `You have a new booking request. ${customerData.name} has requested a booking for ${serviceData.category}`,
    });
  } catch (error) {
    console.error('Payment Success Error:', error);
    throw error;
  }
};

export const handleBookingSettlement = async (bookingId: string) => {
  try {
    const payment = await Payment.findOne({ booking: new MongooseTypes.ObjectId(bookingId) });
    if (!payment || !payment.provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Payment record not found for this booking');
    
    if (payment.paymentStatus === PAYMENT_STATUS.SETTLED) {
      return; // Already settled
    }

    const providerId = payment.provider.toString();
    const providerPay = payment.providerPay;

    // Settle pending penalty dues automatically from provider's earnings
    const creditAmount = await settlePendingPenaltyDues(providerId, providerPay);

    // Credit provider wallet
    await User.findByIdAndUpdate(providerId, {
      $inc: { 'providerDetails.wallet': creditAmount, 'providerDetails.metrics.totalReceivedJobs': 1 },
    });

    // Update Payment record status
    payment.paymentStatus = PAYMENT_STATUS.SETTLED;
    await payment.save();

    await NotificationService.insertNotification({
      for: payment.provider as any,
      message: `Booking settled. You have received ${creditAmount.toFixed(2)} in your wallet (after any penalty adjustments).`,
    });
  } catch (error) {
    console.error('Booking Settlement Error:', error);
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

// Create a Paystack transfer recipient for a provider
const generateRecipient = async (req: Request) => {
  const user = req.user;
  const { name, accountNumber, bankCode } = req.body;

  if (!name || !accountNumber || !bankCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Name, Account Number and Bank Code are required');
  }

  const userOnDB = await User.findById(user.authId || user.id);
  if (!userOnDB) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User not found');
  }

  const recipient = await createTransferRecipient(name, accountNumber, bankCode);
  
  await User.findByIdAndUpdate(userOnDB._id, { 
    'providerDetails.paystackRecipientCode': recipient.recipient_code,
    'providerDetails.bankName': bankCode,
    'providerDetails.accountNumber': accountNumber,
  });

  return { 
    recipientCode: recipient.recipient_code,
    bankName: bankCode,
    accountNumber: accountNumber
  };
};

// Handle Paystack webhooks
const webhook = async (req: Request) => {
  const payload = req.body; // Buffer from express.raw
  const hash = crypto.createHmac('sha512', config.paystack.secretKey || 'sk_test_placeholder').update(payload).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid Signature!');
  }

  const event = JSON.parse(req.body.toString());

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
  } else if (event.event === 'transfer.success') {
    const data = event.data;
    await Transaction.findOneAndUpdate({ p2ptransactionId: data.reference }, { status: 'COMPLETED' });
  } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
    const data = event.data;
    const tx = await Transaction.findOneAndUpdate({ p2ptransactionId: data.reference }, { status: 'FAILED' });
    if (tx) {
      // Refund user's wallet
      await User.findByIdAndUpdate(tx.provider, { $inc: { 'providerDetails.wallet': tx.amount } });
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

  const withdrawalFee = 0; // Configured to 0 withdrawal fee as requested
  const netPayout = data.amount;

  const transferRes = await initiateTransfer(netPayout, recipientCode as string, `Withdrawal for ${provider.name}`);

  await User.findByIdAndUpdate(provider._id, { 'providerDetails.wallet': (provider.providerDetails?.wallet || 0) - data.amount })
    .lean()
    .exec();

  await Transaction.create({
    type: 'WITHDRAWAL',
    provider: provider._id,
    amount: data.amount,
    fee: withdrawalFee,
    netAmount: netPayout,
    status: 'PENDING',
    p2ptransactionId: transferRes.reference,
  });
};

export const PaymentServices = {
  generateRecipient,
  webhook,
  getWallet,
  getPaymentHistory,
  getPaymentDetails,
  withdraw,
};
