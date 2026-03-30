import { Schema, model } from 'mongoose';
import { IDispute } from './dispute.interface';

const disputeSchema = new Schema<IDispute>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    raisedBy: {
      type: String,
      enum: ['client', 'provider'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    evidence: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'rejected'],
      default: 'open',
    },
    resolution: {
      type: {
        type: String,
        enum: ['refund', 'partial_refund', 'release_payment', null],
        default: null,
      },
      amount: {
        type: Number,
      },
      note: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Dispute = model<IDispute>('Dispute', disputeSchema);
