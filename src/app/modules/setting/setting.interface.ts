import { Document } from 'mongoose';

export interface ISetting extends Document {
  isSubscribeActive: boolean;
}
