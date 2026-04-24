// Review Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Review } from './review.model';
import { Booking } from '../booking/booking.model';
import { User } from '../user/user.model';
import QueryBuilder from '../../builder/QueryBuilder';

import mongoose from 'mongoose';

// Create a new review for a completed booking and update provider ranking
const createReview = async (user: JwtPayload, payload: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const booking = await Booking.findById(payload.bookingId)
      .populate('service provider')
      .session(session)
      .lean()
      .exec();
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the booking you want to review.');

    const review = await Review.create(
      [
        {
          ...payload,
          creator: user.authId,
          provider: (booking.provider as any)._id || booking.provider,
          service: (booking.service as any)._id || booking.service,
        },
      ],
      { session },
    );

    if (review) {
      await (User as any).updateRankingScore(
        (booking.provider as any)._id || booking.provider,
        session,
      );
    }

    await session.commitTransaction();
    await session.endSession();

    return review[0];
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// Retrieve all reviews for a specific provider with pagination
const getReviewsByProvider = async (providerId: string, query: any) => {
  const reviewQuery = new QueryBuilder(
    Review.find({ provider: providerId }).populate('creator', 'name image'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await reviewQuery.modelQuery.lean().exec();
  const meta = await reviewQuery.getPaginationInfo();
  return { meta, data };
};

// Retrieve all reviews for a specific service with pagination
const getReviewsByService = async (serviceId: string, query: any) => {
  const reviewQuery = new QueryBuilder(
    Review.find({ service: serviceId }).populate('creator', 'name image'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await reviewQuery.modelQuery.lean().exec();
  const meta = await reviewQuery.getPaginationInfo();
  return { meta, data };
};

export const ReviewService = {
  createReview,
  getReviewsByProvider,
  getReviewsByService,
};
