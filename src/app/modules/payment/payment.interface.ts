import { Types } from 'mongoose';
import { PAYMENT_STATUS } from '../../../enum/payment';

export interface IPayment {
  _id?: Types.ObjectId;
  customId?: string;
  paymentStatus: PAYMENT_STATUS;
  isSettled: boolean;
  customer?: Types.ObjectId;
  provider?: Types.ObjectId;
  service?: Types.ObjectId;
  booking?: Types.ObjectId;
  paymentId?: string;
  servicePrice: number;
  vat: number;
  platformFee: number;
  paystackGatewayFee: number;
  providerPay: number;
  refundAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
