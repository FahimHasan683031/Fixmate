import { Model, Types } from 'mongoose';
import { MESSAGE } from '../../../enum/message';

export interface IMessage {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  message: string;
  image: string;
  sender: Types.ObjectId;
  isSeen: boolean;
}

export type MessageModel = Model<IMessage, Record<string, unknown>>;
