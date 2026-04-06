import { z } from 'zod';
import { BOOKING_STATUS } from '../../../enum/booking';

const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(BOOKING_STATUS, {
      errorMap: () => ({ message: 'Please provide a valid booking status' }),
    }),
    reason: z.string().optional(),
  }),
});

const createBookingSchema = z.object({
  body: z.object({
    service: z.string({ required_error: 'Service ID is required' }),
    date: z.string({ required_error: 'Booking date is required' }),
    location: z.object({
      type: z.literal('Point'),
      coordinates: z.array(z.number()),
    }).optional(),
    address: z.string({ required_error: 'Address is required' }),
    specialNote: z.string().optional(),
  }),
});

export const BookingValidation = {
  createBookingSchema,
  updateStatusSchema,
};
