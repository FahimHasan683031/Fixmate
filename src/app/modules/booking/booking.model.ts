import { model, Schema } from "mongoose";
import { IBooking } from "./booking.interface";
import { BOOKING_STATUS } from "../../../enum/booking";

const bookingSchema = new Schema<IBooking>({
    customer: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    provider: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    service: {
        type: Schema.Types.ObjectId,
        ref: "Service"
    },
    status: {
        type: [String],
        default: [
            "Pending"
        ]
    },
    date: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    address: {
        type: String,
        default: ""
    },
    specialNote: {
        type: String,
        default: ""
    },
    paymentId: {
        type: String,
        default: ""
    },
    bookingStatus: {
        type: String,
        enum: Object.values(BOOKING_STATUS),
        default: BOOKING_STATUS.PENDING
    },
    transactionId: {
        type: String,
    },
    rejectReason: {
        type: String,
        default: ""
    },
    isPaid: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

bookingSchema.index({ location: '2dsphere' });

export const Booking = model<IBooking>("Booking", bookingSchema);
