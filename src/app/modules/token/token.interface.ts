import { Model, Types } from 'mongoose';

export type IToken = {
    user: Types.ObjectId;
    token: string;
    expireAt: Date;
};

export type TokenModel = {
    isExistToken(token: string): any;
    isExpireToken(token: string): boolean;
} & Model<IToken>;
