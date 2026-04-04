// User Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcrypt';
import ApiError from '../../../errors/ApiError';
import unlinkFile from '../../../shared/unlinkFile';
import { IUser } from './user.interface';
import { User } from './user.model';
import { USER_STATUS, USER_ROLES } from '../../../enum/user';
import exceljs from 'exceljs';
import QueryBuilder from '../../builder/QueryBuilder';
import { Review } from '../review/review.model';
import { Booking } from '../booking/booking.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import { Verification } from '../verification/verification.model';

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

// Retrieve a paginated list of non-admin users
const getUsers = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ role: { $ne: USER_ROLES.ADMIN }, status: { $ne: USER_STATUS.DELETED } }), query)
    .search(['name', 'email', 'address'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery.lean().exec();
  const meta = await userQuery.getPaginationInfo();
  return { meta, data: result };
};

// Get details of a single user by ID
const getUser = async (id: string) => {
  const result: any = await User.findById(id).lean().exec();
  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  if (result.role === USER_ROLES.CLIENT) {
    return {
      role: result.role,
      name: result.name,
      image: result.image,
      category: result.category,
      gender: result.gender,
      dateOfBirth: result.dateOfBirth,
      nationality: result.nationality,
      email: result.email,
      whatsapp: result.whatsApp,
      contact: result.contact,
      address: result.address,
    };
  }

  if (result.role === USER_ROLES.PROVIDER) {
    const reviews = await Review.find({ provider: result._id })
      .select('-updatedAt -__v -provider -service')
      .populate({ path: 'creator', select: 'name image' })
      .lean()
      .exec();

    const averageRating =
      reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length : 0;

    const [completedWork, upCommingWork, cancelWork] = await Promise.all([
      Booking.countDocuments({
        provider: result._id,
        bookingStatus: { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED] },
      }),
      Booking.countDocuments({ provider: result._id, bookingStatus: BOOKING_STATUS.ACCEPTED }),
      Booking.countDocuments({ provider: result._id, bookingStatus: BOOKING_STATUS.CANCELLED }),
    ]);

    const verificationFile: any = await Verification.findOne({ user: result._id }).lean().exec();

    return {
      name: result.name,
      role: result.role,
      image: result.image,
      category: result.category,
      gender: result.gender,
      dateOfBirth: result.dateOfBirth,
      nationality: result.nationality,
      email: result.email,
      whatsapp: result.whatsApp,
      contact: result.contact,
      address: result.address,

      completedWork,
      upCommingWork,
      cancelWork,

      experience: result.providerDetails?.experience,
      totalDoneWork: completedWork,
      review: averageRating,

      expertise: result.providerDetails?.category,
      country: result.nationality,
      serviceArea: result.address,
      serviceDistance: result.providerDetails?.distance,
      availableTime: {
        startTime: result.providerDetails?.startTime ?? '',
        endTime: result.providerDetails?.endTime ?? '',
      },
      availableDay: result.providerDetails?.availableDay,
      overview: result.providerDetails?.overView,

      licenses: verificationFile ? [verificationFile.license, verificationFile.nid] : [],
    };
  }

  return result;
};

// Block, unblock, or soft-delete a user
const blockAndUnblockUser = async (id: string, status: string) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  if (status === 'block') user.status = USER_STATUS.BLOCKED;
  else if (status === 'unblock') user.status = USER_STATUS.ACTIVE;
  else if (status === 'delete') user.status = USER_STATUS.DELETED;

  await user.save();
  return user;
};

export const UserService = {
  getProfile,
  updateUserProfile,
  updateProviderProfile,
  deleteProfile,
  downloadUsers,
  getUsers,
  getUser,
  blockAndUnblockUser,
};
