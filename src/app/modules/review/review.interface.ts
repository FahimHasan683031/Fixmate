import { Types } from 'mongoose'

export interface IReview {
  _id: Types.ObjectId;
  creator: Types.ObjectId;
  provider: Types.ObjectId;
  service: Types.ObjectId;
  review: string;
  rating: number;
}
