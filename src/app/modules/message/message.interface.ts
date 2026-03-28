import { Model, Types } from 'mongoose';

export interface IMessage {
  _id: Types.ObjectId;
  customId?: string;
  chatId: Types.ObjectId;
  message: string;
  image: string;
  sender: Types.ObjectId;
  isSeen: boolean;
}

export type MessageModel = Model<IMessage, Record<string, unknown>>;
