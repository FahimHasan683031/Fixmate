import { Schema, model } from "mongoose";
import { IPayment } from "./payment.interface";
import { PAYMENT_STATUS } from "../../../enum/payment";

const paymentSchema = new Schema<IPayment>({
  customer: { type: Schema.Types.ObjectId, ref: "User" },
  provider: { type: Schema.Types.ObjectId, ref: "User" },
  service: { type: Schema.Types.ObjectId, ref: "Service" },
  booking: { type: Schema.Types.ObjectId, ref: "Booking" },
  amount: { type: Number, required: true },
  gatewayFee: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  providerAmount: { type: Number, default: 0 },
  description: { type: String, default: "" },
  paymentId: { type: String },
  paymentStatus: { type: String, required: true, enum: Object.values(PAYMENT_STATUS) },
}, { timestamps: true });

export const Payment = model<IPayment>("Payment", paymentSchema);
