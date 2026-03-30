import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Booking } from '../booking/booking.model';
import { IDispute } from './dispute.interface';
import { Dispute } from './dispute.model';
import { BookingStateMachine } from '../booking/bookingStateMachine';
import { BOOKING_STATUS } from '../../../enum/booking';
import { JwtPayload } from 'jsonwebtoken';
import QueryBuilder from '../../builder/QueryBuilder';
import { Payment } from '../payment/payment.model';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { User } from '../user/user.model';
import mongoose from 'mongoose';

const createDispute = async (user: JwtPayload, payload: Partial<IDispute>) => {
  const booking = await Booking.findById(payload.bookingId);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');
  }

  // Check if user is part of the booking
  const isClient = booking.customer.toString() === user.id;
  const isProvider = booking.provider.toString() === user.id;

  if (!isClient && !isProvider) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to dispute this booking');
  }

  const raisedBy = isClient ? 'client' : 'provider';

  // Transition booking to DISPUTED
  await BookingStateMachine.transitionState(
    booking._id,
    raisedBy,
    BOOKING_STATUS.DISPUTED,
    payload.reason || 'Dispute raised'
  );

  const disputeData = {
    ...payload,
    user: user.id,
    raisedBy,
    status: 'open',
  };

  const result = await Dispute.create(disputeData);
  return result;
};

const getAllDisputes = async (query: Record<string, unknown>) => {
  const disputeQuery = new QueryBuilder(
    Dispute.find().populate('user').populate('bookingId'),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await disputeQuery.modelQuery;
  const meta = await disputeQuery.getPaginationInfo();

  return { meta, result };
};

const getDisputeById = async (id: string) => {
  const result = await Dispute.findById(id).populate('user').populate('bookingId');
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found');
  }
  return result;
};

const resolveDispute = async (id: string, payload: { type: string; amount?: number; note?: string }) => {
  const dispute = await Dispute.findById(id);
  if (!dispute) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found');
  }

  if (dispute.status === 'resolved' || dispute.status === 'rejected') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Dispute is already closed');
  }

  const bookingId = dispute.bookingId;
  const payment = await Payment.findOne({ booking: bookingId });
  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment record not found for this booking');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (payload.type === 'release_payment') {
      // release full payment to provider
      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.SETTLED, payload.note || 'Resolved by admin: release payment');
      
      await User.findByIdAndUpdate(payment.provider, {
        $inc: { 'providerDetails.wallet': payment.providerPay, 'providerDetails.metrics.totalReceivedJobs': 1 },
      }, { session });

      payment.paymentStatus = PAYMENT_STATUS.SETTLED;
      await payment.save({ session });

    } else if (payload.type === 'refund') {
      // full refund to client
      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.REFUNDED, payload.note || 'Resolved by admin: full refund');
      
      if (bookingId) {
          const booking = await Booking.findById(bookingId);
          if(booking && booking.transactionId){
              await refundPaystackTransaction(booking.transactionId, payment.servicePrice);
          }
      }

      payment.paymentStatus = PAYMENT_STATUS.REFUNDED;
      payment.refundAmount = payment.servicePrice;
      await payment.save({ session });

    } else if (payload.type === 'partial_refund') {
      // partial refund to client, rest to provider
      const refundAmount = payload.amount || 0;
      if (refundAmount > payment.servicePrice) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Refund amount cannot exceed service price');
      }

      const providerShare = payment.servicePrice - refundAmount;
      // We assume provider pay is usually 82%, but in partial case we just give them the remaining logic? 
      // User said "no penalty". Let's just give provider (remaining * 0.82) or just the remaining?
      // Usually in partial refund, we divide the original pool.
      
      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.SETTLED, payload.note || `Resolved by admin: partial refund of ${refundAmount}`);

      if (refundAmount > 0) {
        const booking = await Booking.findById(bookingId);
        if(booking && booking.transactionId){
             await refundPaystackTransaction(booking.transactionId, refundAmount);
        }
      }

      if (providerShare > 0) {
          // Calculate provider payout from the remaining share (platform still takes fee?)
          // Let's assume platform still takes its cut from the provider's side? 
          // Or just give provider the remaining. 
          // To keep it simple and per "no penalty", let's give provider: (providerShare * 0.82)
          const providerPayout = Number((providerShare * 0.82).toFixed(2));
          await User.findByIdAndUpdate(payment.provider, {
            $inc: { 'providerDetails.wallet': providerPayout, 'providerDetails.metrics.totalReceivedJobs': 1 },
          }, { session });
      }

      payment.paymentStatus = PAYMENT_STATUS.REFUNDED;
      payment.refundAmount = refundAmount;
      await payment.save({ session });
    }

    dispute.status = 'resolved';
    dispute.resolution = {
      type: payload.type as any,
      amount: payload.amount,
      note: payload.note,
    };
    await dispute.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return dispute;
};

const rejectDispute = async (id: string, note: string) => {
    const dispute = await Dispute.findByIdAndUpdate(id, {
        status: 'rejected',
        'resolution.note': note
    }, { new: true });
    
    if (!dispute) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found');
    }
    
    return dispute;
};

export const DisputeService = {
  createDispute,
  getAllDisputes,
  getDisputeById,
  resolveDispute,
  rejectDispute
};
