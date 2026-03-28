import { Types } from 'mongoose';
import { PAYMENT_STATUS, PAYMENT_TYPE, SETTLEMENT_TYPE } from '../../../enum/payment';

// Base fields shared by every payment record
export interface IPaymentBase {
  _id?: Types.ObjectId;
  customId?: string;
  paymentType: PAYMENT_TYPE;
  paymentStatus: PAYMENT_STATUS;

  // Common references
  customer?: Types.ObjectId;
  provider?: Types.ObjectId;
  service?: Types.ObjectId;
  booking?: Types.ObjectId;

  // Gateway reference ID (Paystack charge id / reference)
  paymentId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

// 1. Client pays for a service booking
export interface IServicePayment extends IPaymentBase {
  paymentType: PAYMENT_TYPE.SERVICE_PAYMENT;
  serviceAmount: number; // Full price of the service
  platformFee: number; // Platform commission (e.g. 15%)
  gatewayFee: number; // Payment gateway fee (e.g. 3%)
  providerAmount: number; // Amount credited to provider wallet
}

// 2. Booking cancelled → refund to client
export interface ICancellationRefund extends IPaymentBase {
  paymentType: PAYMENT_TYPE.CANCELLATION_REFUND;
  originalAmount: number;      // What the client originally paid
  penaltyFee: number;          // Cancellation penalty deducted
  refundedAmount: number;      // Net amount actually refunded
  cancellationReason?: string; // Who cancelled and why
  providerDeduction?: number;  // If provider cancelled, the deduction amount
}


// 4. Provider withdraws wallet funds to bank
export interface IWithdrawal extends IPaymentBase {
  paymentType: PAYMENT_TYPE.WITHDRAWAL;
  withdrawAmount: number; // Amount requested by provider
  withdrawalFee: number; // Fee charged (e.g. 10%)
  netPayout: number; // Actual bank transfer amount
}

// 5. Auto or manual settlement of funds to provider
export interface ISettlement extends IPaymentBase {
  paymentType: PAYMENT_TYPE.SETTLEMENT;
  settledAmount: number; // Amount settled to provider
  settlementType: SETTLEMENT_TYPE; // AUTO or MANUAL
}

// 6. Disputed booking → refund back to client
export interface IDisputeRefund extends IPaymentBase {
  paymentType: PAYMENT_TYPE.DISPUTE_REFUND;
  originalAmount: number; // Amount originally charged
  refundedAmount: number; // Amount refunded
  disputeReason?: string;
}

// Union type
export type IPayment =
  | IServicePayment
  | ICancellationRefund
  | IWithdrawal
  | ISettlement
  | IDisputeRefund;
