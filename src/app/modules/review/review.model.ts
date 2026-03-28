import { model, Schema } from 'mongoose';
import { IReview } from './review.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const ReviewSchema = new Schema<IReview>(
  {
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    review: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ReviewSchema.index({ provider: 1 });
ReviewSchema.index({ service: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ createdAt: -1 });

ReviewSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('RVW');
  }
  next();
});

export const Review = model<IReview>('Review', ReviewSchema);
