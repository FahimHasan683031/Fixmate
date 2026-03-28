import { Model, Types } from 'mongoose';

export type IChat = {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  lastMessage: Types.ObjectId;
};

export type ChatModel = Model<IChat, Record<string, unknown>>;
