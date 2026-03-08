import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { IUser } from '../user/user.interface';
import unlinkFile from '../../../shared/unlinkFile';

const getUserProfile = async (user: JwtPayload) => {
    const existingUser = await User.findById(user.authId || user.id).select(
        'name image gender email address dateOfBirth nationality whatsApp contact role'
    );
    if (!existingUser) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
    }
    return existingUser;
};

const updateProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
    const userId = user.authId || user.id;
    const existingUser = await User.findById(userId);
    if (!existingUser) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
    }

    if (payload.image && existingUser.image) {
        unlinkFile(existingUser.image);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, payload, {
        new: true,
    }).lean();

    return updatedUser;
};

const deleteProfile = async (user: JwtPayload, password: string) => {
    const userId = user.authId || user.id;
    const existingUser = await User.findById(userId).select('+password');
    if (!existingUser) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
    }

    const isMatch = password && (await bcrypt.compare(password, existingUser.password));
    if (!isMatch) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Password not match!');
    }

    // Update status to DELETED instead of hard delete (matching source repo pattern)
    await User.findByIdAndUpdate(userId, { status: 'DELETED' });
    return null;
};

export const ClientServices = {
    getUserProfile,
    updateProfile,
    deleteProfile,
};
