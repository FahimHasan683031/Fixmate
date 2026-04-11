import { Types } from 'mongoose';
import { ITransaction, ITransactionType } from './transaction.interface';
import { Transaction } from './transaction.model';
import QueryBuilder from '../../builder/QueryBuilder';
import exceljs from 'exceljs';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';

const recordTransaction = async (data: {
  type: ITransactionType;
  user: string | Types.ObjectId;
  amount: number;
  fee?: number;
  booking?: string | Types.ObjectId;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  p2ptransactionId?: string;
}) => {
  const amount = data.amount || 0;
  const fee = data.fee || 0;
  const netAmount = amount - fee;

  const transactionData: Partial<ITransaction> = {
    type: data.type,
    user: new Types.ObjectId(data.user),
    booking: data.booking ? new Types.ObjectId(data.booking) : undefined,
    amount,
    fee,
    netAmount,
    status: data.status || 'COMPLETED',
    p2ptransactionId: data.p2ptransactionId || '',
  };

  return await Transaction.create(transactionData);
};

const getAllTransactions = async (query: Record<string, unknown>) => {
  const transactionQuery = new QueryBuilder(
    Transaction.find().populate('user', 'name email contact role').populate('booking', 'customId category'),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await transactionQuery.modelQuery.lean().exec();
  const meta = await transactionQuery.getPaginationInfo();

  return { meta, data };
};

const downloadTransactions = async (query: Record<string, unknown>) => {
  const { startDate, endDate, format } = query;

  if (!format || !['csv', 'excel'].includes((format as string).toLowerCase())) {
     throw new ApiError(StatusCodes.BAD_REQUEST, "Please specify a valid file format (CSV or Excel) to download your transactions.");
  }

  const mongoQuery: any = {};
  
  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) mongoQuery.createdAt.$gte = new Date(startDate as string);
    // Include the whole end date day by setting to end of day if only YYYY-MM-DD is passed
    if (endDate) {
       const end = new Date(endDate as string);
       end.setUTCHours(23, 59, 59, 999);
       mongoQuery.createdAt.$lte = end;
    }
  }

  const transactions = await Transaction.find(mongoQuery)
    .populate('user', 'name role email contact')
    .populate('booking', 'customId category')
    .sort('-createdAt')
    .lean();

  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet('Transactions');

  worksheet.columns = [
    { header: 'Transaction ID', key: 'txId', width: 25 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'User Name', key: 'userName', width: 20 },
    { header: 'User Role', key: 'userRole', width: 15 },
    { header: 'Booking ID', key: 'bookingId', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Fee', key: 'fee', width: 15 },
    { header: 'Net Amount', key: 'netAmount', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Ref (Paystack)', key: 'ref', width: 25 },
  ];

  transactions.forEach((tx: any) => {
    worksheet.addRow({
      txId: tx.customId || tx._id.toString(),
      date: tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A',
      type: tx.type,
      userName: tx.user?.name || 'N/A',
      userRole: tx.user?.role || 'N/A',
      bookingId: tx.booking?.customId || 'N/A',
      amount: tx.amount,
      fee: tx.fee,
      netAmount: tx.netAmount,
      status: tx.status,
      ref: tx.p2ptransactionId || '',
    });
  });

  // Apply some styling to header row
  worksheet.getRow(1).font = { bold: true };

  let buffer: Buffer;
  let contentType: string;
  let fileExtension: string;

  if (format === 'excel') {
    buffer = (await workbook.xlsx.writeBuffer()) as any as Buffer;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    fileExtension = 'xlsx';
  } else {
    // Default to CSV
    buffer = (await workbook.csv.writeBuffer()) as any as Buffer;
    contentType = 'text/csv';
    fileExtension = 'csv';
  }

  return { buffer, contentType, fileExtension };
};

const getTransactionById = async (id: string) => {
  const result = await Transaction.findById(id)
    .populate('user', 'name email contact role image')
    .populate('booking', 'customId category subCategory price')
    .lean()
    .exec();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Transaction not found');
  }

  return result;
};

export const TransactionService = {
  recordTransaction,
  getAllTransactions,
  getTransactionById,
  downloadTransactions,
};
