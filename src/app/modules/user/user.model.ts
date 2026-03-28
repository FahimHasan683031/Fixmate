import mongoose, { Schema, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser, UserModel } from './user.interface';
import { GENDER, USER_ROLES, USER_STATUS, VERIFICATION_STATUS } from '../../../enum/user';
import { SERVICE_DAY } from '../../../enum/service';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { generateCustomId } from '../../../utils/idGenerator';

const UserSchema = new Schema<IUser, UserModel>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: 0,
    },
    image: {
      type: String,
      default: '',
    },
    contact: {
      type: String,
      default: '',
    },
    whatsApp: {
      type: String,
      default: '',
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: Object.values(GENDER),
      default: GENDER.MALE,
    },
    address: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },

    category: {
      type: String,
      default: '',
    },
    nationalId: {
      type: String,
      default: '',
    },
    nationality: {
      type: String,
      default: '',
    },
    experience: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: '',
    },
    overView: {
      type: String,
      default: '',
    },
    wallet: {
      type: Number,
      default: 0,
    },

    location: {
      type: {
        type: String,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    distance: {
      type: Number,
      default: 20,
    },
    availableDay: {
      type: [String],
      enum: Object.values(SERVICE_DAY),
      default: [],
    },
    startTime: {
      type: String,
      default: '',
    },
    endTime: {
      type: String,
      default: '',
    },

    paystackRecipientCode: {
      type: String,
      default: '',
    },
    bankName: {
      type: String,
      default: '',
    },
    accountNumber: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.UNVERIFIED,
    },
    fcmToken: {
      type: String,
      default: '',
    },
    deviceToken: {
      type: String,
      default: '',
    },
    authentication: {
      type: {
        restrictionLeftAt: {
          type: Date,
          default: null,
        },
        resetPassword: {
          type: Boolean,
          default: false,
        },
        wrongLoginAttempts: {
          type: Number,
          default: 0,
        },
        passwordChangedAt: {
          type: Date,
        },
        oneTimeCode: {
          type: String,
          default: '',
        },
        latestRequestAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
        },
        requestCount: {
          type: Number,
          default: 0,
        },
        authType: {
          type: String,
          enum: ['createAccount', 'resetPassword'],
        },
      },
      select: 0,
    },
    rankingScore: { type: Number, default: 0 },
    customId: { type: String, unique: true, sparse: true },
    metrics: {
      acceptedJobs: { type: Number, default: 0 },
      declinedJobs: { type: Number, default: 0 },
      completedJobs: { type: Number, default: 0 },
      totalReceivedJobs: { type: Number, default: 0 },
      disputedJobs: { type: Number, default: 0 },
      totalResponseTime: { type: Number, default: 0 },
      totalResponseCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);

UserSchema.index({ location: '2dsphere' });

UserSchema.virtual('fullName').get(function (this: IUser) {
  return this.name;
});

UserSchema.virtual('metrics.acceptance_rate').get(function (this: IUser) {
  return this.metrics.totalReceivedJobs > 0
    ? Math.round((this.metrics.acceptedJobs / this.metrics.totalReceivedJobs) * 100)
    : 0;
});

UserSchema.virtual('metrics.decline_rate').get(function (this: IUser) {
  return this.metrics.totalReceivedJobs > 0
    ? Math.round((this.metrics.declinedJobs / this.metrics.totalReceivedJobs) * 100)
    : 0;
});

UserSchema.virtual('metrics.avg_response_time').get(function (this: IUser) {
  return this.metrics.totalResponseCount > 0
    ? Math.round(this.metrics.totalResponseTime / this.metrics.totalResponseCount)
    : 0;
});

UserSchema.virtual('metrics.completion_rate').get(function (this: IUser) {
  return this.metrics.acceptedJobs > 0
    ? Math.round((this.metrics.completedJobs / this.metrics.acceptedJobs) * 100)
    : 0;
});

UserSchema.virtual('metrics.dispute_rate').get(function (this: IUser) {
  return this.metrics.acceptedJobs > 0
    ? Math.round((this.metrics.disputedJobs / this.metrics.acceptedJobs) * 100)
    : 0;
});

UserSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
) {
  return bcrypt.compare(givenPassword, savedPassword);
};

UserSchema.statics.isExistUserById = async function (id: string) {
  return await this.findById(id).select('+password');
};

UserSchema.statics.isExistUserByEmail = async function (email: string) {
  return await this.findOne({ email }).select('+password');
};

UserSchema.statics.updateRankingScore = async function (
  providerId: string | Types.ObjectId,
  session?: mongoose.ClientSession,
) {
  const user = await this.findById(providerId).session(session || null).lean().exec();
  if (!user || user.role !== USER_ROLES.PROVIDER) return;

  const metrics = user.metrics || {
    acceptedJobs: 0,
    completedJobs: 0,
    totalReceivedJobs: 0,
    totalResponseCount: 0,
    totalResponseTime: 0,
  };

  const completionRate =
    metrics.acceptedJobs > 0 ? (metrics.completedJobs / metrics.acceptedJobs) * 100 : 0;
  const acceptanceRate =
    metrics.totalReceivedJobs > 0 ? (metrics.acceptedJobs / metrics.totalReceivedJobs) * 100 : 0;
  const avgResponseTime =
    metrics.totalResponseCount > 0 ? metrics.totalResponseTime / metrics.totalResponseCount : 0;

  const ratingResult = await mongoose
    .model('Review')
    .aggregate([
      { $match: { provider: new Types.ObjectId(providerId as string) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ])
    .session(session || null);

  const avgRating = ratingResult.length > 0 ? ratingResult[0].avgRating || 0 : 0;

  const oneDayInMs = 24 * 60 * 60 * 1000;
  const oneHourInMs = 60 * 60 * 1000;
  const responseTimeFactor = Math.max(
    0,
    100 - (Math.max(0, avgResponseTime - oneHourInMs) / (oneDayInMs - oneHourInMs)) * 100,
  );

  const score =
    (completionRate || 0) * 0.4 +
    (acceptanceRate || 0) * 0.3 +
    ((avgRating || 0) / 5) * 100 * 0.2 +
    (responseTimeFactor || 0) * 0.1;

  const finalScore = isNaN(score) ? 0 : Math.round(score * 100) / 100;

  await this.findByIdAndUpdate(
    providerId,
    { rankingScore: finalScore },
    { session: session || null },
  );
};

UserSchema.pre('save', async function (this: IUser & mongoose.Document, next) {
  try {
    if (this.isNew && !this.customId) {
      const prefix = this.role === USER_ROLES.PROVIDER ? 'PRV' : 'USR';
      this.customId = await generateCustomId(prefix);
    }
    if (this.isModified('email')) {
      const isExist = await User.findOne({
        email: this.email,
        status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.BLOCKED] },
        _id: { $ne: this._id },
      });

      if (isExist) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, 'An account with this email already exists'),
        );
      }
    }
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, Number(config.bcrypt_salt_rounds));
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const User = mongoose.model<IUser, UserModel>('User', UserSchema);
