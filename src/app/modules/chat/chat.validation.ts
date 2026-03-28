import { z } from 'zod';

const createChatSchema = z.object({
  body: z
    .object({
      user: z.string({ required_error: 'User is required' }),
    })
    .required(),
});

const chatIdSchema = z.object({
  params: z
    .object({
      id: z.string({ required_error: 'Chat ID is required' }),
    })
    .strict(),
});

export const ChatValidations = {
  createChatSchema,
  chatIdSchema,
};
