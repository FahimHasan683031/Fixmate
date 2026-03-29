import { Types } from 'mongoose';

export interface ITransaction {
  _id?: Types.ObjectId;
  customId?: string;
  type: string;
  provider: Types.ObjectId;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}
