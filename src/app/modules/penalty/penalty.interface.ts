import { Types } from 'mongoose';

export interface IPenalty {
  _id?: Types.ObjectId;
  customId?: string;
  user: Types.ObjectId; // Who incurred the penalty
  type: 'CLIENT' | 'PROVIDER';
  booking: Types.ObjectId;
  service?: Types.ObjectId;
  amount: number;
  taken: number;
  due: number;
  reason: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt?: Date;
  updatedAt?: Date;
}
