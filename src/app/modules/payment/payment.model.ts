import { model, Schema } from "mongoose";
import { IPayment } from "./payment.interface";

const PaymentSchema = new Schema<IPayment>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentId: {
      type: String,
      required: false,
    },
    transactionId: {
      type: String,
      required: false,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },
    dateTime: {
      type: Date,
      required: false,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 100,
    },

  },
  { timestamps: true }
);

// Index for better search performance
PaymentSchema.index({ email: 1, dateTime: -1 });


export const Payment = model<IPayment>('Payment', PaymentSchema);
