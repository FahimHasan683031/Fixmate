import { Types } from 'mongoose';
import { BOOKING_STATUS } from '../../../enum/booking';

export interface IBooking {
  _id: Types.ObjectId;
  customId?: string;
  customer: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  bookingStatus: BOOKING_STATUS;
  currentStats: Record<string, boolean>;
  date: Date;
  location: {
    type: 'Point';
    coordinates: number[];
  };
  address: string;
  specialNote: string;
  isPaid: boolean;
  rejectReason: string;
  paymentId: string;
  isDeleted: boolean;
  transactionId: string;
  respondedAt?: Date;
  disputeReason?: string;
  disputedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
