import { z } from "zod";
import { BOOKING_STATUS } from "../../../enum/booking";

const createBookingSchema = z.object({
    body: z.object({
        service: z.string({ required_error: "Service ID is required" }),
        date: z.string({ required_error: "Booking date is required" }),
        location: z.object({
            type: z.literal("Point"),
            coordinates: z.array(z.number()),
        }).optional(),
        address: z.string({ required_error: "Address is required" }),
        specialNote: z.string().optional(),
    }),
});

const updateBookingStatusSchema = z.object({
    body: z.object({
        status: z.enum(Object.values(BOOKING_STATUS) as [string, ...string[]], {
            required_error: "Status is required",
        }),
        reason: z.string().optional(),
    }),
});

export const BookingValidation = {
    createBookingSchema,
    updateBookingStatusSchema,
};
