import { Types } from 'mongoose';

export type IPayment = {
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  booking: Types.ObjectId;
  amount: number;
  paymentId?: string;
  transactionId?: string;
  paymentStatus: string;
  email?: string;
  dateTime?: Date;
  referenceId?: Types.ObjectId;
  description?: string;
  customerName?: string;
  createdAt: Date;
  updatedAt: Date;
};

