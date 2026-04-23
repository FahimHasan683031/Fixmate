import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Booking } from '../booking/booking.model';
import { IDispute } from './dispute.interface';
import { Dispute } from './dispute.model';
import { BookingStateMachine } from '../booking/bookingStateMachine';
import { BOOKING_STATUS } from '../../../enum/booking';
import { USER_ROLES } from '../../../enum/user';
import { JwtPayload } from 'jsonwebtoken';
import { Payment } from '../payment/payment.model';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { User } from '../user/user.model';
import { NotificationService } from '../notification/notification.service';
import { Penalty } from '../penalty/penalty.model';
import { settlePendingPenaltyDues } from '../penalty/penalty.utils';
import mongoose, { Types as MongooseTypes } from 'mongoose';
import { TransactionService } from '../transaction/transaction.service';

// Create a new dispute
const createDispute = async (user: JwtPayload, payload: Partial<IDispute>) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const booking = await Booking.findById(payload.bookingId).session(session);
    if (!booking) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the booking record for this dispute.');
    }

    // Check if user is part of the booking
    const isClient = booking.customer.toString() === user.authId;
    const isProvider = booking.provider.toString() === user.authId;

    if (!isClient && !isProvider) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You don\'t have permission to raise a dispute for this booking.');
    }

    const raisedBy = isClient ? 'client' : 'provider';

    const previousBookingStatus = booking.bookingStatus;

    // Transition booking to DISPUTED
    await BookingStateMachine.transitionState(
      booking._id,
      raisedBy,
      BOOKING_STATUS.DISPUTED,
      payload.reason || 'Dispute raised',
      session
    );

    const disputeData = {
      ...payload,
      user: user.authId,
      raisedBy,
      status: 'open',
      previousBookingStatus,
    };

    const result = await Dispute.create([disputeData], { session });
    
    await session.commitTransaction();

    // Notify admins asynchronously
    Promise.all([
      User.find({ role: USER_ROLES.ADMIN }),
      User.findById(user.authId).select('name email').lean()
    ]).then(([admins, raisedByUser]) => {
      admins.forEach(admin => {
        NotificationService.insertNotification({
          for: admin._id,
          message: `A new dispute has been raised by ${raisedByUser?.name || 'a user'} for booking ID: ${booking.customId || 'unspecified'}. Please review it at your earliest convenience.`,
        }).catch(err => console.error("Failed to notify admin about dispute:", err));
      });
    }).catch(err => console.error("Failed to fetch users for dispute notification:", err));

    return result[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Get all disputes
const getAllDisputes = async (query: Record<string, unknown>) => {
  const { searchTerm, ...rest } = query;

  const matchStage: any = {};
  if (rest.status) matchStage.status = rest.status;

  const pipeline: any[] = [{ $match: matchStage }];

  pipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, image: 1, customId: 1 } }],
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        pipeline: [
          { $project: { customId: 1, service: 1 } },
          {
            $lookup: {
              from: 'services',
              localField: 'service',
              foreignField: '_id',
              pipeline: [{ $project: { name: 1, category: 1, customId: 1 } }],
              as: 'service',
            },
          },
          { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        ],
        as: 'bookingId',
      },
    },
    { $unwind: { path: '$bookingId', preserveNullAndEmptyArrays: true } },
  );

  if (searchTerm) {
    pipeline.push({
      $match: {
        $or: [
          { customId: { $regex: searchTerm, $options: 'i' } },
          { 'user.customId': { $regex: searchTerm, $options: 'i' } },
          { 'bookingId.customId': { $regex: searchTerm, $options: 'i' } },
        ],
      },
    });
  }

  const sortStr = (rest.sort as string) || '-createdAt';
  const sortDir = sortStr.startsWith('-') ? -1 : 1;
  const sortField = sortStr.replace('-', '');
  pipeline.push({ $sort: { [sortField]: sortDir } });

  const page = Number(rest.page) || 1;
  const limit = Number(rest.limit) || 10;
  const skip = (page - 1) * limit;

  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: skip }, { $limit: limit }],
    },
  });

  const result = await Dispute.aggregate(pipeline);

  const total = result[0]?.metadata[0]?.total || 0;
  const data = result[0]?.data || [];
  const totalPage = Math.ceil(total / limit);

  return { meta: { total, limit, page, totalPage }, result: data };
};

// Get a single dispute by ID
const getDisputeById = async (id: string) => {
  const result = await Dispute.findById(id).populate('user', 'name email contact image role address customId').populate({
    path: 'bookingId',
    select: 'customId bookingStatus service date location address',
    populate: { path: 'service', select: 'name category price image customId' },
  });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the dispute record.');
  }
  return result;
};

// Resolve a dispute
const resolveDispute = async (id: string, payload: { type: string; amount?: number; note?: string }) => {
  const dispute = await Dispute.findById(id);
  if (!dispute) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the dispute record.');
  }

  if (dispute.status === 'resolved') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This dispute has already been resolved or closed.');
  }

  const bookingId = dispute.bookingId;
  const payment = await Payment.findOne({ booking: bookingId });
  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find a payment record associated with this booking.');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (payload.type === 'release_payment') {
      // release full payment to provider
      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.SETTLED, payload.note || 'Resolved by admin: release payment');
      
      const creditAmount = await settlePendingPenaltyDues((payment.provider as MongooseTypes.ObjectId).toString(), payment.providerPay);

      await User.findByIdAndUpdate(payment.provider, {
        $inc: { 'providerDetails.wallet': creditAmount, 'providerDetails.metrics.totalReceivedJobs': 1 },
      }, { session });

      payment.paymentStatus = PAYMENT_STATUS.SETTLED;
      await payment.save({ session });

      await TransactionService.recordTransaction({
        type: 'EARNINGS',
        user: (payment.provider as MongooseTypes.ObjectId),
        booking: bookingId,
        amount: payment.providerPay,
        status: 'COMPLETED',
      });

    } else if (payload.type === 'refund') {
      // full refund to client
      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.CANCELLED, payload.note || 'Resolved by admin: full refund');
      
      if (payment.paymentStatus === PAYMENT_STATUS.SETTLED) {
        // RECLAIM logic: provider already received money, take it back
        const reclaimAmount = payment.providerPay;
        const providerData = await User.findById(payment.provider).session(session);
        if (providerData) {
            const currentWallet = providerData.providerDetails?.wallet || 0;
            const taken = currentWallet > 0 ? Math.min(currentWallet, reclaimAmount) : 0;
            const due = reclaimAmount - taken;

            if (due > 0) {
              const pendingDueTotal = await Penalty.aggregate([
                { $match: { user: providerData.customId, status: 'PENDING' } },
                { $group: { _id: null, total: { $sum: '$due' } } },
              ]).session(session);

              const newTotalDue = (pendingDueTotal[0]?.total || 0) + due;
              await User.findByIdAndUpdate(providerData._id, { 'providerDetails.wallet': -newTotalDue }, { session });
            } else {
              await User.findByIdAndUpdate(providerData._id, { $inc: { 'providerDetails.wallet': -taken } }, { session });
            }

            await Penalty.create([{
              user: providerData.customId,
              type: 'PROVIDER',
              booking: (await Booking.findById(bookingId).select('customId'))?.customId,
              amount: reclaimAmount,
              taken,
              due,
              reason: `Dispute Refund: Reclaim for already settled booking (ID: ${payment.customId})`,
              status: due > 0 ? 'PENDING' : 'COMPLETED',
            }], { session });

            await TransactionService.recordTransaction({
              type: 'PENALTY',
              user: providerData._id,
              booking: bookingId,
              amount: reclaimAmount,
              status: 'COMPLETED',
            });

            await TransactionService.recordTransaction({
              type: 'PENALTY',
              user: providerData._id,
              booking: bookingId,
              amount: reclaimAmount,
              status: 'COMPLETED',
            });

            await NotificationService.insertNotification({
              for: providerData._id,
              message: `A refund of $${reclaimAmount.toFixed(2)} was reclaimed from your wallet following a dispute resolution. ($${taken.toFixed(2)} was deducted, with $${due.toFixed(2)} remaining as outstanding).`,
            });
        }
      }

      const booking = await Booking.findById(bookingId);
      if(booking && booking.transactionId){
          await refundPaystackTransaction(booking.transactionId, payment.servicePrice);
      }

      payment.paymentStatus = PAYMENT_STATUS.REFUNDED;
      payment.refundAmount = payment.servicePrice;
      await payment.save({ session });

    } else if (payload.type === 'partial_refund') {
      // partial refund to client, rest to provider
      const refundAmount = payload.amount || 0;
      if (refundAmount > payment.servicePrice) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'The refund amount must be less than or equal to the total service price.');
      }

      await BookingStateMachine.adminForceState(bookingId, BOOKING_STATUS.SETTLED, payload.note || `Resolved by admin: partial refund of ${refundAmount}`);

      if (payment.paymentStatus === PAYMENT_STATUS.SETTLED) {
          // RECLAIM logic for partial refund
          const reclaimAmount = refundAmount; 
          const providerData = await User.findById(payment.provider).session(session);
          if (providerData) {
              const currentWallet = providerData.providerDetails?.wallet || 0;
              const taken = currentWallet > 0 ? Math.min(currentWallet, reclaimAmount) : 0;
              const due = reclaimAmount - taken;

              if (due > 0) {
                const pendingDueTotal = await Penalty.aggregate([
                  { $match: { user: providerData.customId, status: 'PENDING' } },
                  { $group: { _id: null, total: { $sum: '$due' } } },
                ]).session(session);
  
                const newTotalDue = (pendingDueTotal[0]?.total || 0) + due;
                await User.findByIdAndUpdate(providerData._id, { 'providerDetails.wallet': -newTotalDue }, { session });
              } else {
                await User.findByIdAndUpdate(providerData._id, { $inc: { 'providerDetails.wallet': -taken } }, { session });
              }
  
              await Penalty.create([{
                user: providerData.customId,
                type: 'PROVIDER',
                booking: (await Booking.findById(bookingId).select('customId'))?.customId,
                amount: reclaimAmount,
                taken,
                due,
                reason: `Dispute Partial Refund: Reclaim for already settled booking (ID: ${payment.customId})`,
                status: due > 0 ? 'PENDING' : 'COMPLETED',
              }], { session });

              await TransactionService.recordTransaction({
                type: 'PENALTY',
                user: providerData._id,
                booking: bookingId,
                amount: reclaimAmount,
                status: 'COMPLETED',
              });

              await NotificationService.insertNotification({
                for: providerData._id,
                message: `A partial refund of $${reclaimAmount.toFixed(2)} was reclaimed from your wallet following a dispute resolution. ($${taken.toFixed(2)} was deducted, with $${due.toFixed(2)} remaining as outstanding).`,
              });
          }
      }

      const booking = await Booking.findById(bookingId);
      if(booking && booking.transactionId){
           await refundPaystackTransaction(booking.transactionId, refundAmount);
      }

      if (payment.paymentStatus !== PAYMENT_STATUS.SETTLED) {
          const providerShare = payment.servicePrice - refundAmount;
          if (providerShare > 0) {
              const providerInfo = await User.findById(payment.provider).lean().session(session);
              const isSubscribed = providerInfo?.providerDetails?.subscription?.isSubscribed && 
                   (providerInfo.providerDetails.subscription.expiryDate ? new Date(providerInfo.providerDetails.subscription.expiryDate) > new Date() : false);
              const providerPayRatio = isSubscribed ? 0.85 : 0.82;
              
              const providerPayout = Number((providerShare * providerPayRatio).toFixed(2));
              const creditAmount = await settlePendingPenaltyDues((payment.provider as MongooseTypes.ObjectId).toString(), providerPayout);
              await User.findByIdAndUpdate(payment.provider, {
                $inc: { 'providerDetails.wallet': creditAmount, 'providerDetails.metrics.totalReceivedJobs': 1 },
              }, { session });

              await TransactionService.recordTransaction({
                type: 'EARNINGS',
                user: (payment.provider as MongooseTypes.ObjectId),
                booking: bookingId,
                amount: providerPayout,
                status: 'COMPLETED',
              });
          }
      }

      payment.paymentStatus = PAYMENT_STATUS.PARTIAL_REFUNDED;
      payment.refundAmount = refundAmount;
      await payment.save({ session });
    } else if (payload.type === 'rejected') {
      // Revert booking status back to previous state
      if (dispute.previousBookingStatus) {
        await BookingStateMachine.adminForceState(
          bookingId,
          dispute.previousBookingStatus as any,
          payload.note || 'Dispute rejected: reverting to previous status'
        );
      }

      await NotificationService.insertNotification({
        for: dispute.user as any,
        message: `Your dispute request has been reviewed and was not accepted at this time. Note: ${payload.note}`,
      });
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

export const DisputeService = {
  createDispute,
  getAllDisputes,
  getDisputeById,
  resolveDispute,
};
