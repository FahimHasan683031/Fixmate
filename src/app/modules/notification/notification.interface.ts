import { Model, Types } from 'mongoose';

export type INotification = {
  customId?: string;
  for: Types.ObjectId;
  message: string;
  isRead: boolean;
  readAt?: Date;
};

export type NotificationModel = Model<INotification>;
