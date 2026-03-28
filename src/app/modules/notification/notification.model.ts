import { model, Schema } from 'mongoose';
import { INotification, NotificationModel } from './notification.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const notificationSchema = new Schema<INotification, NotificationModel>(
  {
    for: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      required: false,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('NTF');
  }
  next();
});

export const Notification = model<INotification, NotificationModel>(
  'Notification',
  notificationSchema,
);
