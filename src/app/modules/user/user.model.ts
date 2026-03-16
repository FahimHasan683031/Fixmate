import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { IUser, UserModel } from "./user.interface";
import { GENDER, USER_ROLES, USER_STATUS } from "../../../enum/user";
import { SERVICE_DAY } from "../../../enum/service";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiError";
import config from "../../../config";

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
            default: "",
        },
        contact: {
            type: String,
            default: "",
        },
        whatsApp: {
            type: String,
            default: "",
        },
        dateOfBirth: {
            type: String,
            default: "",
        },
        gender: {
            type: String,
            enum: Object.values(GENDER),
            default: GENDER.MALE,
        },
        address: {
            type: String,
            default: "",
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            required: true,
        },

        // Provider specific
        category: {
            type: String,
            default: "",
        },
        nationalId: {
            type: String,
            default: "",
        },
        nationality: {
            type: String,
            default: "",
        },
        experience: {
            type: String,
            default: "",
        },
        language: {
            type: String,
            default: "",
        },
        overView: {
            type: String,
            default: "",
        },
        wallet: {
            type: Number,
            default: 0,
        },

        // Location & Service
        location: {
            type: {
                type: String,
                default: "Point",
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
            default: "",
        },
        endTime: {
            type: String,
            default: "",
        },

        // Payout
        paystackRecipientCode: {
            type: String,
            default: "",
        },
        bankName: {
            type: String,
            default: "",
        },
        accountNumber: {
            type: String,
            default: "",
        },

        // Auth & Status
        status: {
            type: String,
            enum: Object.values(USER_STATUS),
            default: USER_STATUS.ACTIVE,
        },
        verified: {
            type: Boolean,
            default: false,
        },
        fcmToken: {
            type: String,
            default: "",
        },
        deviceToken: {
            type: String,
            default: "",
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
                    default: "",
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
            select: 0
        },
        metrics: {
            acceptedJobs: { type: Number, default: 0 },
            declinedJobs: { type: Number, default: 0 },
            completedJobs: { type: Number, default: 0 },
            totalReceivedJobs: { type: Number, default: 0 },
            disputedJobs: { type: Number, default: 0 },
            totalResponseTime: { type: Number, default: 0 },
            totalResponseCount: { type: Number, default: 0 },
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
        },
        toObject: {
            virtuals: true,
        },
    }
);

UserSchema.index({ location: "2dsphere" });

UserSchema.virtual('fullName').get(function () {
    return this.name;
});

UserSchema.virtual('metrics.acceptance_rate').get(function () {
    return this.metrics.totalReceivedJobs > 0 
        ? Math.round((this.metrics.acceptedJobs / this.metrics.totalReceivedJobs) * 100) 
        : 0;
});

UserSchema.virtual('metrics.decline_rate').get(function () {
    return this.metrics.totalReceivedJobs > 0 
        ? Math.round((this.metrics.declinedJobs / this.metrics.totalReceivedJobs) * 100) 
        : 0;
});

UserSchema.virtual('metrics.avg_response_time').get(function () {
    return this.metrics.totalResponseCount > 0 
        ? Math.round(this.metrics.totalResponseTime / this.metrics.totalResponseCount) 
        : 0;
});

UserSchema.virtual('metrics.completion_rate').get(function () {
    return this.metrics.acceptedJobs > 0 
        ? Math.round((this.metrics.completedJobs / this.metrics.acceptedJobs) * 100) 
        : 0;
});

UserSchema.virtual('metrics.dispute_rate').get(function () {
    return this.metrics.acceptedJobs > 0 
        ? Math.round((this.metrics.disputedJobs / this.metrics.acceptedJobs) * 100) 
        : 0;
});

UserSchema.statics.isPasswordMatched = async function (
    givenPassword: string,
    savedPassword: string
) {
    return bcrypt.compare(givenPassword, savedPassword);
};

UserSchema.statics.isExistUserById = async function (id: string) {
    return await this.findById(id).select("+password");
};

UserSchema.statics.isExistUserByEmail = async function (email: string) {
    return await this.findOne({ email }).select("+password");
};

UserSchema.pre("save", async function (next) {
    try {
        if (this.isModified("email")) {
            const isExist = await User.findOne({
                email: this.email,
                status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.BLOCKED] },
                _id: { $ne: this._id },
            });

            if (isExist) {
                return next(
                    new ApiError(
                        StatusCodes.BAD_REQUEST,
                        "An account with this email already exists"
                    )
                );
            }
        }
        if (this.isModified("password")) {
            this.password = await bcrypt.hash(
                this.password,
                Number(config.bcrypt_salt_rounds)
            );
        }
        next();
    } catch (error) {
        next(error as Error);
    }
});

export const User = mongoose.model<IUser, UserModel>("User", UserSchema);

