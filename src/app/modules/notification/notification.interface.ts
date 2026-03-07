import { Model, Types } from 'mongoose';

export type INotification = {
    title: string;
    message: string;
    receiver: Types.ObjectId;
    read: boolean;
    referenceId?: Types.ObjectId;
    screen?: string;
    type: "USER" | "ADMIN";
};

export type NotificationModel = Model<INotification>;