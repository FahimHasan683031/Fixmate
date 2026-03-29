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
    .select('-password -authentication -isDeleted')
    .lean()
    .exec();

  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
  return existingUser;
};

// Update standard user profile (Admin/Customer)
const updateUserProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
  const userId = user.id || user.authId;
  const existingUser = await User.findById(userId).lean().exec();
  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');

  if (payload.image && existingUser.image) unlinkFile(existingUser.image!);

  const updatedUser = await User.findByIdAndUpdate(userId, payload, { new: true })
    .select('-password -authentication')
    .lean()
    .exec();

  return updatedUser;
};

// Update provider profile (with providerDetails)
const updateProviderProfile = async (user: JwtPayload, payload: any) => {
  const userId = user.id || user.authId;
  const existingUser = await User.findById(userId).lean().exec();
  if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');

  if (payload.image && existingUser.image) unlinkFile(existingUser.image!);

  // Flatten providerDetails if present to perform a deep update using dot notation
  const updateData: any = { ...payload };
  if (updateData.providerDetails) {
    for (const key in updateData.providerDetails) {
      updateData[`providerDetails.${key}`] = updateData.providerDetails[key];
    }
    delete updateData.providerDetails;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true })
    .select('-password -authentication')
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
  updateUserProfile,
  updateProviderProfile,
  deleteProfile,
};
