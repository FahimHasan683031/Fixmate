import { z } from 'zod';

const createPenaltySchema = z.object({
  body: z.object({
    provider: z.string({
      required_error: 'Provider customId is required',
    }),
    booking: z.string({
      required_error: 'Booking customId is required',
    }),
    amount: z.number({
      required_error: 'Amount is required',
    }).positive('Amount must be positive'),
    reason: z.string({
      required_error: 'Reason is required',
    }),
  }),
});

export const PenaltyValidation = {
  createPenaltySchema,
};
