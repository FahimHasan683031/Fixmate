import { Schema, model } from 'mongoose';
import { ITransaction } from './transaction.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const transactionSchema = new Schema<ITransaction>(
  {
    type: { type: String, required: true },
    provider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: { type: String, required: true },
    customId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

transactionSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('TRX');
  }
  next();
});

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
