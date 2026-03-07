import { Model, Types } from "mongoose";
import { USER_ROLES, USER_STATUS } from "../../../enum/user";
export { USER_ROLES, USER_STATUS };

type IAuthentication = {
    restrictionLeftAt: Date | null
    resetPassword: boolean
    wrongLoginAttempts: number
    passwordChangedAt?: Date
    oneTimeCode: string
    latestRequestAt: Date
    expiresAt?: Date
    requestCount?: number
    authType?: 'createAccount' | 'resetPassword'
}

export type IUser = {
    _id: Types.ObjectId;
    email: string;
    image?: string;
    password: string;
    firstName: string;
    lastName: string;
    status: USER_STATUS;
    verified: boolean;
    role: USER_ROLES;
    authentication: IAuthentication;
    deviceToken?: string;
    fcmToken?: string;
    fullName?: string;
};

export type UserModel = {
    isPasswordMatched: (givenPassword: string, savedPassword: string) => Promise<boolean>;
} & Model<IUser>;
