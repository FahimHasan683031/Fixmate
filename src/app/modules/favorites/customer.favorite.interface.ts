import { Types } from 'mongoose';

export interface ICustomerFavorite {
  customId?: string;
  customer: Types.ObjectId;
  provider: Types.ObjectId;
}
