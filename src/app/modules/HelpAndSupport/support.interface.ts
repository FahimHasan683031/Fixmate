import { Types } from "mongoose";

export interface ISupport {
    _id?: string;
    title: string;
    description: string;
    attachment: string;
    user: Types.ObjectId;
    status: string;
}
