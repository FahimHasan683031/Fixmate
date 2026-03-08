import { model, Schema } from 'mongoose';
import { IToken, TokenModel } from './token.interface';

const tokenSchema = new Schema<IToken, TokenModel>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        token: {
            type: String,
            required: true,
        },
        expireAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

//token check
tokenSchema.statics.isExistToken = async (
    token: string
): Promise<IToken | null> => {
    return await Token.findOne({ token });
};

//token validity check
tokenSchema.statics.isExpireToken = async (token: string) => {
    const currentDate = new Date();
    const resetToken = await Token.findOne({
        token,
        expireAt: { $gt: currentDate },
    });
    return !!resetToken;
};

export const Token = model<IToken, TokenModel>(
    'Token',
    tokenSchema
);
