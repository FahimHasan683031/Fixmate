import { Types } from 'mongoose';
import { ITransaction, ITransactionType } from './transaction.interface';
import { Transaction } from './transaction.model';
import QueryBuilder from '../../builder/QueryBuilder';

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

export const TransactionService = {
  recordTransaction,
  getAllTransactions,
};
