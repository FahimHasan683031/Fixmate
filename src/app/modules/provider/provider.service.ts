// Provider Service
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import { BookingStateMachine } from '../booking/bookingStateMachine';
import QueryBuilder from '../../builder/QueryBuilder';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { Payment } from '../payment/payment.model';
import { NotificationService } from '../notification/notification.service';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { Review } from '../review/review.model';
import { IPaginationOptions } from '../../../interfaces/pagination';

// Retrieve key statistics and the next available booking for the provider's home screen
export const providerHome = async (payload: JwtPayload) => {
  const id = new Types.ObjectId(payload.id || payload.authId);
  const now = new Date();

  const [balanceResult, newRequests, upCommingOrder, completedOrder, availableDayResult] =
    await Promise.all([
      User.findById(id).select('providerDetails.wallet').lean(),
      Booking.countDocuments({ provider: id, bookingStatus: BOOKING_STATUS.REQUESTED }),
      Booking.countDocuments({ provider: id, bookingStatus: BOOKING_STATUS.ACCEPTED }),
      Booking.countDocuments({
        provider: id,
        bookingStatus: {
          $in: [
            BOOKING_STATUS.COMPLETED_BY_PROVIDER,
            BOOKING_STATUS.CONFIRMED_BY_CLIENT,
            BOOKING_STATUS.SETTLED,
          ],
        },
      }),
      Booking.find({
        provider: id,
        date: { $gte: now },
        bookingStatus: { $in: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS] },
      })
        .select('date')
        .sort({ date: 1 })
        .limit(1)
        .lean(),
    ]);

  return {
    balance: balanceResult?.providerDetails?.wallet || 0,
    pendigTask: newRequests, // Current field (misspelled)
    complitedTask: completedOrder, // Current field (misspelled)
    availableDay: availableDayResult.length > 0 ? availableDayResult[0].date : null, // Current field

    // Legacy fields for parity
    totalEarning: balanceResult?.providerDetails?.wallet || 0,
    completedOrder: completedOrder,
    upCommingOrder: upCommingOrder,
    newRequests: newRequests,
  };
};

// Fetch detailed profile information for a specific customer
export const getCustomer = async (id: string) => {
  const customer = await User.findById(id)
    .select('name image address gender dateOfBirth nationality contact whatsApp')
    .lean()
    .exec();
  if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, 'Customer not found!');
  return customer;
};

// Retrieve a summarized view of a booking for the provider's "see booking" screen
export const seeBooking = async (user: JwtPayload, id: string) => {
  const provider = await User.findById(user.id || user.authId)
    .lean()
    .exec();
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found!');

  const booking: any = await Booking.findById(id)
    .populate([
      { path: 'service', select: 'image price category subCategory whatsApp contact' },
      { path: 'customer', select: 'name image address category whatsApp contact' },
    ])
    .lean()
    .exec();

  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');

  return {
    service: { ...booking.service, date: booking.date },
    details: {
      distance: provider.providerDetails?.distance,
      status: booking.bookingStatus,
      fee: booking.service?.price,
      address: booking.address,
      specialNote: booking.specialNote,
      customer: booking.customer,
      paymentStatus: booking.paymentStatus,
    },
  };
};

// Process status transitions (accept, reject, start, complete) for a booking from the provider side
const actionBooking = async (
  _user: JwtPayload,
  data: { bookId: string; action: 'accept' | 'reject' | 'start' | 'complete'; reason?: string },
) => {
  const bookingInfo: any = await Booking.findById(data.bookId).lean().exec();
  if (!bookingInfo) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');

  if (data.action == 'accept') {
    await BookingStateMachine.transitionState(data.bookId, 'provider', BOOKING_STATUS.ACCEPTED);
    await NotificationService.insertNotification({
      for: bookingInfo.customer,
      message: `Your booking for ${bookingInfo.service?.subCategory} has been accepted.`,
    });
  } else if (data.action == 'reject') {
    await BookingStateMachine.transitionState(
      data.bookId,
      'provider',
      BOOKING_STATUS.DECLINED,
      data.reason,
    );
    if (bookingInfo.isPaid && bookingInfo.transactionId) {
      await refundPaystackTransaction(bookingInfo.transactionId);
    }
    await Payment.findOneAndUpdate(
      { booking: new Types.ObjectId(data.bookId) },
      { paymentStatus: PAYMENT_STATUS.REFUNDED },
      { new: true },
    )
      .lean()
      .exec();
    await NotificationService.insertNotification({
      for: bookingInfo.customer,
      message: `Your booking has been rejected.`,
    });
  } else if (data.action == 'start') {
    await BookingStateMachine.transitionState(data.bookId, 'provider', BOOKING_STATUS.IN_PROGRESS);
  } else if (data.action == 'complete') {
    await BookingStateMachine.transitionState(
      data.bookId,
      'provider',
      BOOKING_STATUS.COMPLETED_BY_PROVIDER,
    );
  }
};

// Retrieve and summarize all reviews and ratings received by the provider
const myReviews = async (user: JwtPayload, query: IPaginationOptions) => {
  const reviewQuery = new QueryBuilder(
    Review.find({ provider: new Types.ObjectId(user.id || user.authId) }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const reviews = await reviewQuery.modelQuery.populate('creator', 'name image').lean().exec();

  let averageRating = 0;
  if (reviews.length > 0) {
    const total = reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0);
    averageRating = total / reviews.length;
  }

  const meta = await reviewQuery.getPaginationInfo();

  return {
    meta,
    overview: {
      averageRating,
      totalReviews: reviews.length,
      start: {
        oneStar: reviews.filter((r: any) => r.rating === 1).length,
        twoStar: reviews.filter((r: any) => r.rating === 2).length,
        threeStar: reviews.filter((r: any) => r.rating === 3).length,
        fourStar: reviews.filter((r: any) => r.rating === 4).length,
        fiveStar: reviews.filter((r: any) => r.rating === 5).length,
      },
    },
    data: reviews,
    all: reviews, // Legacy field
  };
};

export const ProviderServices = {
  providerHome,
  getCustomer,
  seeBooking,
  actionBooking,
  myReviews,
};
