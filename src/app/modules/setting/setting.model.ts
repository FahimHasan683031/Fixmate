import { Schema, model } from 'mongoose';
import { ISetting } from './setting.interface';

const SettingSchema = new Schema<ISetting>(
  {
    isSubscribeActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Setting = model<ISetting>('Setting', SettingSchema);
