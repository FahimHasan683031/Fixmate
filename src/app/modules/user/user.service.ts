// User Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcrypt';
import ApiError from '../../../errors/ApiError';
import unlinkFile from '../../../shared/unlinkFile';
import { IUser } from './user.interface';
import { User } from './user.model';
import { USER_STATUS } from '../../../enum/user';
import exceljs from 'exceljs';

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

const downloadUsers = async (query: Record<string, unknown>) => {
  const { startDate, endDate, format } = query;

  if (!format || !['csv', 'excel'].includes((format as string).toLowerCase())) {
     throw new ApiError(StatusCodes.BAD_REQUEST, "File 'format' is required. Must be 'csv' or 'excel'.");
  }

  const mongoQuery: any = {};
  
  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) mongoQuery.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
       const end = new Date(endDate as string);
       end.setUTCHours(23, 59, 59, 999);
       mongoQuery.createdAt.$lte = end;
    }
  }

  const users = await User.find(mongoQuery)
    .sort('-createdAt')
    .lean();

  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet('Users');

  worksheet.columns = [
    { header: 'User ID', key: 'id', width: 25 },
    { header: 'Signup Date', key: 'date', width: 20 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Contact', key: 'contact', width: 15 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Wallet Balance', key: 'wallet', width: 15 },
    { header: 'Location', key: 'location', width: 25 },
  ];

  users.forEach((u: any) => {
    worksheet.addRow({
      id: u.customId || u._id.toString(),
      date: u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A',
      name: u.name,
      email: u.email,
      contact: u.contact,
      role: u.role,
      status: u.status,
      wallet: u.providerDetails?.wallet ?? 'N/A',
      location: u.address ? u.address : 'N/A',
    });
  });

  worksheet.getRow(1).font = { bold: true };

  let buffer: Buffer;
  let contentType: string;
  let fileExtension: string;

  if (format === 'excel') {
    buffer = (await workbook.xlsx.writeBuffer()) as any as Buffer;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    fileExtension = 'xlsx';
  } else {
    buffer = (await workbook.csv.writeBuffer()) as any as Buffer;
    contentType = 'text/csv';
    fileExtension = 'csv';
  }

  return { buffer, contentType, fileExtension };
};

export const UserService = {
  getProfile,
  updateUserProfile,
  updateProviderProfile,
  deleteProfile,
  downloadUsers,
};
