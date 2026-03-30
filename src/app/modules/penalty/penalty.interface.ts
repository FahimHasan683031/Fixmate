import { Types } from 'mongoose';

export interface IPenalty {
  _id?: Types.ObjectId;
  customId?: string;
  user: string;
  type: 'CLIENT' | 'PROVIDER';
  booking: string;
  amount: number;
  taken: number;
  due: number;
  reason: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt?: Date;
  updatedAt?: Date;
}
