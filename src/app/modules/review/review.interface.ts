import { Types } from 'mongoose';

export interface IReview {
  _id: Types.ObjectId;
  customId?: string;
  creator: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  review: string;
  rating: number;
}
