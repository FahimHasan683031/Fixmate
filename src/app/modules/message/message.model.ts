import { Schema, model } from 'mongoose';
import { IMessage, MessageModel } from './message.interface';
import { MESSAGE } from '../../../enum/message';

const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat"
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    image: {
      type: String
    },
    message: {
      type: String
    },
    isSeen: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const Message = model<IMessage, MessageModel>('Message', messageSchema);
