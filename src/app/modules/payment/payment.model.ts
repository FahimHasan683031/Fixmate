import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';
import { PAYMENT_STATUS, PAYMENT_TYPE, SETTLEMENT_TYPE } from '../../../enum/payment';
import { generateCustomId } from '../../../utils/idGenerator';

const paymentSchema = new Schema<any>(
  {
    // ── Discriminator ────────────────────────────────────────────
    paymentType: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_TYPE),
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_STATUS),
    },

    // ── Common References ────────────────────────────────────────
    customer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    provider: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    paymentId: { type: String, default: '' },

    // ── SERVICE_PAYMENT fields ───────────────────────────────────
    serviceAmount: { type: Number, default: null },
    platformFee: { type: Number, default: null },
    gatewayFee: { type: Number, default: null },
    providerAmount: { type: Number, default: null },

    // ── CANCELLATION_REFUND + PROVIDER_PENALTY + DISPUTE_REFUND ─
    originalAmount: { type: Number, default: null },
    penaltyFee: { type: Number, default: null },
    refundedAmount: { type: Number, default: null },
    cancellationReason: { type: String, default: '' },
    providerDeduction: { type: Number, default: null },
    disputeReason: { type: String, default: '' },
    reason: { type: String, default: '' },

    // ── WITHDRAWAL fields ────────────────────────────────────────
    withdrawAmount: { type: Number, default: null },
    withdrawalFee: { type: Number, default: null },
    netPayout: { type: Number, default: null },

    // ── SETTLEMENT fields ────────────────────────────────────────
    settledAmount: { type: Number, default: null },
    settlementType: {
      type: String,
      enum: Object.values(SETTLEMENT_TYPE),
      default: null,
    },

    // ── UID ──────────────────────────────────────────────────────
    customId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

paymentSchema.index({ paymentType: 1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ provider: 1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ createdAt: -1 });

paymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('PAY');
  }
  next();
});

export const Payment = model<IPayment & Document>('Payment', paymentSchema);
