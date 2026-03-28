import { Types } from 'mongoose';

export interface IService {
  _id: Types.ObjectId;
  customId?: string;
  creator: Types.ObjectId;
  image: string;
  category: string;
  subCategory: string;
  price: number;
  expertise: string;
  isDeleted: boolean;
}
