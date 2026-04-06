import { Types } from "mongoose";

export interface IDispute {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  bookingId: Types.ObjectId;
  raisedBy: "client" | "provider";
  reason: string;
  description: string;
  evidence: string[];
  status: "open" | "in_review" | "resolved";
  previousBookingStatus?: string;
  resolution?: {
    type: "refund" | "partial_refund" | "release_payment" | "rejected" | null;
    amount?: number;
    note?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
