import { Model, Types } from 'mongoose';
import { GENDER, USER_ROLES, USER_STATUS, VERIFICATION_STATUS } from '../../../enum/user';
import { SERVICE_DAY } from '../../../enum/service';
export { USER_ROLES, USER_STATUS };

type IAuthentication = {
  restrictionLeftAt: Date | null;
  resetPassword: boolean;
  wrongLoginAttempts: number;
  passwordChangedAt?: Date;
  oneTimeCode: string;
  latestRequestAt: Date;
  expiresAt?: Date;
  requestCount?: number;
  authType?: 'createAccount' | 'resetPassword';
};

export type IUser = {
  _id: Types.ObjectId;
  customId?: string;

  name: string;
  email: string;
  password: string;
  image?: string;
  contact: string;
  whatsApp: string;
  dateOfBirth: string;
  gender: GENDER;
  address: string;
  role: USER_ROLES;

  category: string;
  nationalId: string;
  nationality: string;
  experience: string;
  language: string;
  overView: string;
  wallet: number;

  location: {
    type: 'Point';
    coordinates: number[];
  };
  distance: number;
  availableDay: SERVICE_DAY[];
  startTime: string;
  endTime: string;

  paystackRecipientCode: string;
  paystackAccountId: string;
  bankName: string;
  accountNumber: string;

  status: USER_STATUS;
  isDeleted: boolean;
  rankingScore: number;
  verified: boolean;
  verificationStatus: VERIFICATION_STATUS;
  fcmToken: string;
  deviceToken?: string;
  authentication: IAuthentication;

  metrics: {
    acceptedJobs: number;
    declinedJobs: number;
    completedJobs: number;
    totalReceivedJobs: number;
    disputedJobs: number;
    totalResponseTime: number;
    totalResponseCount: number;
  };

  fullName?: string;
};

export type UserModel = {
  isPasswordMatched: (givenPassword: string, savedPassword: string) => Promise<boolean>;
  isExistUserByEmail(email: string): Promise<IUser | null>;
  updateRankingScore(providerId: string | Types.ObjectId): Promise<void>;
  isExistUserById(id: string): Promise<IUser | null>;
} & Model<IUser>;
