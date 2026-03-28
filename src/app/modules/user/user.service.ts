// User Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcrypt';
import ApiError from '../../../errors/ApiError';
import unlinkFile from '../../../shared/unlinkFile';
import { IUser } from './user.interface';
import { User } from './user.model';
import { USER_STATUS } from '../../../enum/user';

// Retrieve the current user's profile information
const getProfile = async (user: JwtPayload) => {
  const existingUser = await User.findById(user.id || user.authId)
    .select(
      'name image gender overView email address dateOfBirth nationality whatsApp contact role experience language distance availableDay startTime endTime category paystackRecipientCode bankName accountNumber',
    )
    .lean()
    .exec();

  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
  return existingUser;
};

// Update user profile details and handle profile image replacement
const updateProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
  const userId = user.id || user.authId;
  const existingUser = await User.findById(userId).lean().exec();
  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');

  if (payload.image && existingUser.image) unlinkFile(existingUser.image!);

  const updatedUser = await User.findByIdAndUpdate(userId, payload, { new: true })
    .select('+image')
    .lean()
    .exec();

  return updatedUser;
};

// Soft-delete the user's account after verifying their password
const deleteProfile = async (user: JwtPayload, payload: { password: string }) => {
  const userId = user.id || user.authId;
  const existingUser = await User.findById(userId).select('+password').lean().exec();
  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');

  const isMatch =
    payload.password && (await bcrypt.compare(payload.password, existingUser.password));
  if (!isMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password does not match!');
  }

  await User.findByIdAndUpdate(existingUser._id, { status: USER_STATUS.DELETED }).lean().exec();
};

export const UserService = {
  getProfile,
  updateProfile,
  deleteProfile,
};
