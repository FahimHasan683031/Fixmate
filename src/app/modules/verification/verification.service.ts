// Verification Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Verification } from './verification.model';
import { IVerificaiton } from './verification.interface';
import { VERIFICATION_STATUS } from '../../../enum/user';
import { User } from '../user/user.model';
import { NotificationService } from '../notification/notification.service';

// Submit or update a provider's verification request with identity documents
const sendRequest = async (user: JwtPayload, payload: Partial<IVerificaiton>) => {
  const existingRequest = await Verification.findOne({ user: user.id || user.authId });
  if (existingRequest && existingRequest.status === VERIFICATION_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You already have a verification request in progress. Please wait for our team to review it.');
  }

  if (existingRequest) {
    return await Verification.findByIdAndUpdate(
      existingRequest._id,
      { ...payload, status: VERIFICATION_STATUS.PENDING },
      { new: true },
    );
  }

  return await Verification.create({
    ...payload,
    user: user.id || user.authId,
    status: VERIFICATION_STATUS.PENDING,
  });
};

// Retrieve the current verification status for the logged-in user
const getStatus = async (user: JwtPayload) => {
  const verification = await Verification.findOne({ user: user.id || user.authId })
    .lean()
    .exec();
  if (!verification) return { status: VERIFICATION_STATUS.UNVERIFIED };
  return verification;
};

// Fetch all pending and processed verification requests
const getAllRequests = async (query: any) => {
  const searchTerm = query.searchTerm as string;
  const sortStr = (query.sort as string) || '-createdAt';
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const sortDir = sortStr.startsWith('-') ? -1 : 1;
  const sortField = sortStr.replace('-', '');

  // Keep verification-level filters clean (e.g., status)
  const excludeFields = ['searchTerm', 'sort', 'page', 'limit', 'fields'];
  const filters: Record<string, any> = { ...query };
  excludeFields.forEach(el => delete filters[el]);
  Object.keys(filters).forEach(key => {
    if (!filters[key] || filters[key] === 'undefined') delete filters[key];
  });

  const pipeline: any[] = [];

  // 1. Root Level Match (status filtering, etc)
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }

  // 2. Perform DB-Engine Lookup ($lookup) to populate User details
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      pipeline: [
        { $project: { _id: 1, name: 1, image: 1, email: 1, contact: 1, address: 1, customId: 1 } }
      ],
      as: 'user',
    }
  });

  // 3. Unwind the populated array into an object
  pipeline.push({
    $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
  });

  // 4. Nested Searching directly using the database engine
  if (searchTerm) {
    pipeline.push({
      $match: {
        $or: [
          { 'user.name': { $regex: searchTerm, $options: 'i' } },
          { 'user.email': { $regex: searchTerm, $options: 'i' } },
          { 'user.contact': { $regex: searchTerm, $options: 'i' } },
        ]
      }
    });
  }

  // 5. Apply the sorting layer
  pipeline.push({ $sort: { [sortField]: sortDir } });

  // 6. Provide Data limits AND total count Metadata simultaneously
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: skip }, { $limit: limit }],
    }
  });

  const result = await Verification.aggregate(pipeline);

  const total = result[0]?.metadata[0]?.total || 0;
  const data = result[0]?.data || [];
  const totalPage = Math.ceil(total / limit);

  return {
    meta: { total, limit, page, totalPage },
    data
  };
};

// get single verification request
const getSingleRequest = async (id: string) => {
  const verification = await Verification.findById(id)
    .populate('user')
    .lean()
    .exec();
  if (!verification) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the verification request details.');
  return verification;
};

// Update the status of a verification request and sync it with the user's profile
const updateStatus = async (id: string, status: VERIFICATION_STATUS) => {
  console.log("hit...",id,status)
  const verification = await Verification.findByIdAndUpdate(id, { status }, { new: true })
    .lean()
    .exec();
  if (!verification) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the verification request details.');

  if (status === VERIFICATION_STATUS.APPROVED) {
    await User.findByIdAndUpdate(verification.user, {
      'providerDetails.verificationStatus': VERIFICATION_STATUS.APPROVED,
    });
  } else if (status === VERIFICATION_STATUS.REJECTED) {
    await User.findByIdAndUpdate(verification.user, {
      'providerDetails.verificationStatus': VERIFICATION_STATUS.REJECTED,
    });
  }

  const message = status === VERIFICATION_STATUS.APPROVED 
    ? 'Congratulations! Your account verification has been approved. You\'re all set to start providing services.' 
    : 'We\'re sorry, but your account verification request was not approved. Please check your documents and try again.';

  await NotificationService.insertNotification({
    for: verification.user as any,
    message,
  });

  return verification;
};

export const VerificationService = {
  sendRequest,
  getStatus,
  getAllRequests,
  getSingleRequest,
  updateStatus,
};
