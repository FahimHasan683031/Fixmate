import mongoose from 'mongoose';
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Penalty } from './penalty.model';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { NotificationService } from '../notification/notification.service';
import QueryBuilder from '../../builder/QueryBuilder';
import { TransactionService } from '../transaction/transaction.service';
import exceljs from 'exceljs';

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

  if (!providerObj) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service provider\'s account.');
  if (!bookingObj) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the booking record in our system.');

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

    if (taken > 0) {
      await TransactionService.recordTransaction({
        type: 'PENALTY',
        user: (providerObj as any)._id,
        booking: (bookingObj as any)._id,
        amount: taken,
        status: 'COMPLETED',
      });
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await NotificationService.insertNotification({
    for: (providerObj as any)._id as any,
    message: `A penalty of $${amount} has been applied to your account due to: ${reason}. $${taken} was deducted from your wallet, and $${due} remains outstanding.`,
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

  if (!authUser?.customId) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find your account information.');

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

const downloadPenalties = async (query: Record<string, unknown>) => {
  const { startDate, endDate, format } = query;

  if (!format || !['csv', 'excel'].includes((format as string).toLowerCase())) {
     throw new ApiError(StatusCodes.BAD_REQUEST, "Please specify a valid file format (CSV or Excel) for your download.");
  }

  const mongoQuery: any = {};
  
  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) mongoQuery.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
       const end = new Date(endDate as string);
       end.setUTCHours(23, 59, 59, 999);
       mongoQuery.createdAt.$lte = end;
    }
  }

  const penalties = await Penalty.find(mongoQuery)
    .sort('-createdAt')
    .lean();

  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet('Penalties');

  worksheet.columns = [
    { header: 'Penalty ID', key: 'id', width: 25 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'User Custom ID', key: 'user', width: 20 },
    { header: 'Booking ID', key: 'booking', width: 20 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Taken', key: 'taken', width: 15 },
    { header: 'Due', key: 'due', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Reason', key: 'reason', width: 30 },
  ];

  penalties.forEach((p: any) => {
    worksheet.addRow({
      id: p.customId || p._id.toString(),
      date: p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A',
      user: p.user || 'N/A',
      booking: p.booking || 'N/A',
      type: p.type,
      amount: p.amount,
      taken: p.taken,
      due: p.due,
      status: p.status,
      reason: p.reason || '',
    });
  });

  worksheet.getRow(1).font = { bold: true };

  let buffer: Buffer;
  let contentType: string;
  let fileExtension: string;

  if (format === 'excel') {
    buffer = (await workbook.xlsx.writeBuffer()) as any as Buffer;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    fileExtension = 'xlsx';
  } else {
    buffer = (await workbook.csv.writeBuffer()) as any as Buffer;
    contentType = 'text/csv';
    fileExtension = 'csv';
  }

  return { buffer, contentType, fileExtension };
};

export const PenaltyService = {
  createPenaltyByAdmin,
  getAllPenalties,
  getMyPenalties,
  downloadPenalties,
};

