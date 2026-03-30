import { Types } from "mongoose";

export interface IDispute {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  // Related booking
  bookingId: Types.ObjectId;

  // Who created the dispute
  raisedBy: "client" | "provider";

  // Dispute details
  reason: string;
  description: string;

  // Evidence files (images, videos, docs)
  evidence: string[];

  // Status of dispute
  status: "open" | "in_review" | "resolved" | "rejected";

  // Resolution details
  resolution?: {
    type: "refund" | "partial_refund" | "release_payment" | null;
    amount?: number;
    note?: string;
  };

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}
