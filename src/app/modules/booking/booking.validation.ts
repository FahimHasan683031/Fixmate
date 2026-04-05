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

export const BookingValidation = {
  updateStatusSchema,
};
