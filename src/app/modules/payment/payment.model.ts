import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { generateCustomId } from '../../../utils/idGenerator';

const paymentSchema = new Schema<any>(
  {
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_STATUS),
    },
    isSettled: {
      type: Boolean,
      default: false,
    },
    customer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    provider: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    paymentId: { type: String, default: '' },
    servicePrice: { type: Number, required: true },
    vat: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    paystackGatewayFee: { type: Number, required: true },
    providerPay: { type: Number, required: true },
    refundAmount: { type: Number, default: 0 },
    customId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

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
