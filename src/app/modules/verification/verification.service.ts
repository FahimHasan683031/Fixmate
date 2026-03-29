// Verification Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Verification } from './verification.model';
import { IVerificaiton } from './verification.interface';
import { VERIFICATION_STATUS } from '../../../enum/user';
import { User } from '../user/user.model';
import QueryBuilder from '../../builder/QueryBuilder';

// Submit or update a provider's verification request with identity documents
const sendRequest = async (user: JwtPayload, payload: Partial<IVerificaiton>) => {
  const existingRequest = await Verification.findOne({ user: user.id || user.authId });
  if (existingRequest && existingRequest.status === VERIFICATION_STATUS.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A verification request is already pending.');
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

// Fetch all pending and processed verification requests for administrative review
const getAllRequests = async (query: any) => {
  const verificationQuery = new QueryBuilder(
    Verification.find().populate('user', 'name image email contact'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await verificationQuery.modelQuery.lean().exec();
  const meta = await verificationQuery.getPaginationInfo();
  return { meta, data };
};

// Update the status of a verification request and sync it with the user's profile
const updateStatus = async (id: string, status: VERIFICATION_STATUS) => {
  const verification = await Verification.findByIdAndUpdate(id, { status }, { new: true })
    .lean()
    .exec();
  if (!verification) throw new ApiError(StatusCodes.NOT_FOUND, 'Verification request not found!');

  if (status === VERIFICATION_STATUS.APPROVED) {
    await User.findByIdAndUpdate(verification.user, {
      'providerDetails.verificationStatus': VERIFICATION_STATUS.APPROVED,
    });
  } else if (status === VERIFICATION_STATUS.REJECTED) {
    await User.findByIdAndUpdate(verification.user, {
      'providerDetails.verificationStatus': VERIFICATION_STATUS.REJECTED,
    });
  }

  return verification;
};

export const VerificationService = {
  sendRequest,
  getStatus,
  getAllRequests,
  updateStatus,
};
