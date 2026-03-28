import { Types } from 'mongoose';

export interface ISupport {
  _id?: Types.ObjectId;
  customId?: string;
  title: string;
  description: string;
  attachment: string;
  user: Types.ObjectId;
  status: string;
}
