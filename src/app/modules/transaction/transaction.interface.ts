import { Types } from 'mongoose';

export type ITransactionType = 'PAYMENT' | 'EARNINGS' | 'REFUND' | 'WITHDRAWAL' | 'PENALTY';

export interface ITransaction {
  _id?: Types.ObjectId;
  customId?: string;
  type: ITransactionType;
  user: Types.ObjectId;
  booking?: Types.ObjectId;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  p2ptransactionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
