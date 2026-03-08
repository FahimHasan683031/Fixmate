import { Types } from "mongoose";

export interface ICustomerFavorite {
    customer: Types.ObjectId;
    provider: Types.ObjectId;
}
