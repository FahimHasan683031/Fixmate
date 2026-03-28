import { Schema, model } from 'mongoose';
import { IMessage, MessageModel } from './message.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    image: {
      type: String,
    },
    message: {
      type: String,
    },
    isSeen: {
      type: Boolean,
      default: false,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

messageSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('MSG');
  }
  next();
});

export const Message = model<IMessage, MessageModel>('Message', messageSchema);
