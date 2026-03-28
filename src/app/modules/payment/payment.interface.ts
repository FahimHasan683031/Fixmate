import { Types } from 'mongoose';
import { PAYMENT_STATUS, PAYMENT_TYPE, SETTLEMENT_TYPE } from '../../../enum/payment';

export interface IPaymentBase {
  _id?: Types.ObjectId;
  customId?: string;
  paymentType: PAYMENT_TYPE;
  paymentStatus: PAYMENT_STATUS;
  customer?: Types.ObjectId;
  provider?: Types.ObjectId;
  service?: Types.ObjectId;
  booking?: Types.ObjectId;
  paymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 1. Client pays for a service booking
export interface IServicePayment extends IPaymentBase {
  paymentType: PAYMENT_TYPE.SERVICE_PAYMENT;
  serviceAmount: number;
  platformFee: number;
  gatewayFee: number;
  providerAmount: number;
}

// 2. Booking cancelled → refund to client
export interface ICancellationRefund extends IPaymentBase {
  paymentType: PAYMENT_TYPE.CANCELLATION_REFUND;
  originalAmount: number;
  penaltyFee: number;
  refundedAmount: number;
  cancellationReason?: string;
  providerDeduction?: number; 
}


// 4. Provider withdraws wallet funds to bank
export interface IWithdrawal extends IPaymentBase {
  paymentType: PAYMENT_TYPE.WITHDRAWAL;
  withdrawAmount: number;
  withdrawalFee: number;
  netPayout: number;
}

// 5. Auto or manual settlement of funds to provider
export interface ISettlement extends IPaymentBase {
  paymentType: PAYMENT_TYPE.SETTLEMENT;
  settledAmount: number;
  settlementType: SETTLEMENT_TYPE; 
}

// 6. Disputed booking → refund back to client
export interface IDisputeRefund extends IPaymentBase {
  paymentType: PAYMENT_TYPE.DISPUTE_REFUND;
  originalAmount: number; 
  refundedAmount: number; 
  disputeReason?: string;
}

// Union type
export type IPayment =
  | IServicePayment
  | ICancellationRefund
  | IWithdrawal
  | ISettlement
  | IDisputeRefund;
