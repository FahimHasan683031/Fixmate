import { z } from 'zod';

const createDisputeSchema = z.object({
  body: z.object({
    bookingId: z.string({ required_error: 'Booking ID is required' }),
    reason: z.string({ required_error: 'Dispute reason is required' }),
    description: z.string({ required_error: 'A detailed description is required' }),
  }),
});

const resolveDisputeSchema = z.object({
  body: z.object({
    type: z.enum(['refund', 'partial_refund', 'release_payment', 'rejected'], {
      required_error: 'Resolution type is required',
    }),
    amount: z.number().optional(),
    note: z.string().optional(),
  }).refine((data) => {
    if (data.type === 'partial_refund' && !data.amount) {
      return false;
    }
    return true;
  }, {
    message: 'Amount is required for partial refund',
    path: ['amount'],
  }),
});

export const DisputeValidation = {
  createDisputeSchema,
  resolveDisputeSchema,
};
