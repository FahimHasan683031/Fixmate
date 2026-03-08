import { Types } from "mongoose";

export interface IPayment {
  _id?: Types.ObjectId;
  customer: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  paymentId: string;
  booking: Types.ObjectId;
  amount: number;
  paymentStatus: string;
}
