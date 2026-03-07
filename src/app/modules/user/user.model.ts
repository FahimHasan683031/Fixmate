import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { IUser, USER_STATUS, UserModel } from "./user.interface";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiError";
import config from "../../../config";

const UserSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        image: {
            type: String,
            default: "",
        },
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "restricted", "deleted"],
            default: "active",
        },
        verified: {
            type: Boolean,
            default: false,
        },
        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user",
        },
        authentication: {
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
            passwordChangedAt: Date,
            oneTimeCode: {
                type: String,
                default: "",
            },
            latestRequestAt: {
                type: Date,
                default: Date.now,
            },
            expiresAt: Date,
            requestCount: {
                type: Number,
                default: 0,
            },
            authType: {
                type: String,
                enum: ['createAccount', 'resetPassword'],
            },
        },
        deviceToken: {
            type: String,
            default: "",
        },
        fcmToken: {
            type: String,
            default: "",
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
    }
);

UserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

UserSchema.statics.isPasswordMatched = async function (
    givenPassword: string,
    savedPassword: string
) {
    return bcrypt.compare(givenPassword, savedPassword);
};

UserSchema.pre("save", async function (next) {
    try {
        if (this.isModified("email")) {
            const isExist = await User.findOne({
                email: this.email,
                status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.RESTRICTED] },
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
