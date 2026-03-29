// Client Service
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { CustomerFavorite } from '../favorites/customer.favorite.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import { BookingStateMachine } from '../booking/bookingStateMachine';

import { Service } from '../service/service.model';
import { Review } from '../review/review.model';
import { Verification } from '../verification/verification.model';

// Get a detailed view of a provider including their favorite status for the client
export const getProviderById = async (user: JwtPayload, id: string, query: any) => {
  const provider: any = await User.findById(id)
    .select(
      'name image providerDetails.overView address providerDetails.distance gender providerDetails.language providerDetails.experience nationality providerDetails.category providerDetails.metrics providerDetails.availableDay providerDetails.startTime providerDetails.endTime',
    )
    .lean()
    .exec();
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found!');

  const services = await Service.find({ creator: id, isDeleted: false })
    .select('creator category image price expertise subCategory')
    .limit(Number(query.servicesLimit) || 10)
    .skip((Number(query.servicesPage) - 1) * Number(query.servicesLimit) || 0)
    .sort({ createdAt: query.servicesSortOrder === 'desc' ? -1 : 1 })
    .populate('creator', 'name image providerDetails.category')
    .lean()
    .exec();

  const completedTask = await Booking.countDocuments({
    provider: id,
    bookingStatus: { $in: [BOOKING_STATUS.SETTLED, BOOKING_STATUS.CONFIRMED_BY_CLIENT] },
  });

  const reviews = await Review.find({ provider: id })
    .select('-updatedAt -__v -provider -service')
    .populate('creator', 'name image')
    .lean()
    .exec();

  let averageRating = 0;
  if (reviews.length > 0) {
    const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    averageRating = total / reviews.length;
  }

  const validationRequest = await Verification.findOne({ user: id }).lean().exec();

  const isFavorite = await CustomerFavorite.findOne({
    customer: user.id || user.authId,
    provider: id,
  })
    .lean()
    .exec();

  return {
    services,
    reviews: {
      overview: {
        averageRating,
        totalReviews: reviews.length,
        start: {
          oneStar: reviews.filter((r) => r.rating === 1).length,
          twoStar: reviews.filter((r) => r.rating === 2).length,
          threeStar: reviews.filter((r) => r.rating === 3).length,
          fourStar: reviews.filter((r) => r.rating === 4).length,
          fiveStar: reviews.filter((r) => r.rating === 5).length,
        },
      },
      all: reviews,
    },
    provider: {
      _id: provider._id,
      name: provider.name,
      image: provider.image,
      category: provider.providerDetails?.category,
      experience: provider.providerDetails?.experience,
      complitedTask: completedTask,
      rating: averageRating,
      isFavorite: !!isFavorite,
      metrics: provider.providerDetails?.metrics,
    },
    overView: {
      overView: provider.providerDetails?.overView,
      language: provider.providerDetails?.language,
      address: provider.address,
      serviceDestance: provider.providerDetails?.distance,
      availableDay: provider.providerDetails?.availableDay,
      startTime: provider.providerDetails?.startTime,
      endTime: provider.providerDetails?.endTime,
      license: validationRequest?.license ?? '',
    },
  };
};



// Retrieve a summarized view of a booking for the client's "see booking" screen
export const seeBooking = async (_user: JwtPayload, id: string) => {
  const booking: any = await Booking.findById(id)
    .populate([
      { path: 'service', select: 'image price category subCategory whatsApp contact' },
      {
        path: 'provider',
        select:
          'name image address providerDetails.distance gender providerDetails.language providerDetails.experience nationality providerDetails.category whatsApp contact',
      },
    ])
    .lean()
    .exec();

  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');

  return {
    service: { ...booking.service, date: booking.date },
    details: {
      status: booking.bookingStatus,
      fee: booking.service?.price,
      address: booking.address,
      specialNote: booking.specialNote,
      provider: booking.provider,
      paymentStatus: booking.paymentStatus,
    },
  };
};

// Update a booking's core information from the client side
const updateBooking = async (_user: JwtPayload, id: string, data: any) => {
  const result = await Booking.findByIdAndUpdate(id, data, { new: true }).lean().exec();
  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');
  return result;
};

// Handle client-side acceptance of a booking to confirm it
const acceptBooking = async (_user: JwtPayload, id: string) => {
  await BookingStateMachine.transitionState(id, 'client', BOOKING_STATUS.CONFIRMED_BY_CLIENT);
  return { message: 'Booking accepted successfully' };
};

export const ClientServices = {
  getProviderById,
  seeBooking,
  updateBooking,
  acceptBooking,
};
