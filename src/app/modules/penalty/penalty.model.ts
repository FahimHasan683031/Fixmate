import { Schema, model } from 'mongoose';
import { IPenalty } from './penalty.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const penaltySchema = new Schema<IPenalty>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['CLIENT', 'PROVIDER'], required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    amount: { type: Number, required: true },
    taken: { type: Number, required: true },
    due: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETED'], required: true },
    customId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

penaltySchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('PNL');
  }
  next();
});

export const Penalty = model<IPenalty>('Penalty', penaltySchema);
