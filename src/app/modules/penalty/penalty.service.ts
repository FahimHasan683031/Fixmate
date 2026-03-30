import mongoose from 'mongoose';
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Penalty } from './penalty.model';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { NotificationService } from '../notification/notification.service';
import QueryBuilder from '../../builder/QueryBuilder';

// crete penalty by admin
const createPenaltyByAdmin = async (payload: {
  provider: string;
  booking: string;
  amount: number;
  reason: string;
}) => {
  const { provider, booking, amount, reason } = payload;

  const [providerObj, bookingObj] = await Promise.all([
    User.findOne({ customId: provider }).select('_id providerDetails.wallet customId').lean(),
    Booking.findOne({ customId: booking }).select('customId').lean(),
  ]);

  if (!providerObj) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found');
  if (!bookingObj) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');

  const currentWallet = (providerObj as any)?.providerDetails?.wallet || 0;
  const taken = currentWallet > 0 ? Math.min(currentWallet, amount) : 0;
  const due = amount - taken;
  const status = due > 0 ? 'PENDING' : 'COMPLETED';

  const session = await mongoose.startSession();
  let result;

  try {
    session.startTransaction();

    if (due > 0) {
      const pendingDueTotal = await Penalty.aggregate([
        { $match: { user: provider, status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$due' } } },
      ]).session(session);

      const newTotalDue = (pendingDueTotal[0]?.total || 0) + due;

      await User.findByIdAndUpdate(
        (providerObj as any)._id,
        { 'providerDetails.wallet': -newTotalDue },
        { session }
      );
    } else {
      await User.findByIdAndUpdate(
        (providerObj as any)._id,
        { $inc: { 'providerDetails.wallet': -amount } },
        { session }
      );
    }

    [result] = await Penalty.create(
      [{ user: provider, type: 'PROVIDER', booking, amount, taken, due, reason, status }],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await NotificationService.insertNotification({
    for: (providerObj as any)._id as any,
    message: `Admin assessed a penalty of $${amount} — Reason: ${reason}. Withheld: $${taken}, Outstanding: $${due}.`,
  });

  return result;
};

// get all penalties
const getAllPenalties = async (query: Record<string, unknown>) => {
  const penaltyQuery = new QueryBuilder(
    Penalty.find().sort('-createdAt'),
    query,
  )
    .search(['customId', 'user', 'booking'])
    .filter()
    .paginate()
    .fields();

  const [data, meta] = await Promise.all([
    penaltyQuery.modelQuery.lean().exec(),
    penaltyQuery.getPaginationInfo(),
  ]);

  return { meta, data };
};

// get my penalties
const getMyPenalties = async (user: JwtPayload, query: Record<string, unknown>) => {
  const userId = user.id || user.authId;

  const authUser = await User.findById(userId).select('customId').lean();
  if (!authUser?.customId) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  const penaltyQuery = new QueryBuilder(
    Penalty.find({ user: authUser.customId }).sort('-createdAt'),
    query,
  )
    .filter()
    .paginate()
    .fields();

  const [data, meta] = await Promise.all([
    penaltyQuery.modelQuery.lean().exec(),
    penaltyQuery.getPaginationInfo(),
  ]);

  return { meta, data };
};

export const PenaltyService = {
  createPenaltyByAdmin,
  getAllPenalties,
  getMyPenalties,
};

