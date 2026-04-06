import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IBooking } from './booking.interface';
import { Booking } from './booking.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import { Service } from '../service/service.model';
import { User } from '../user/user.model';
import { SERVICE_DAY } from '../../../enum/service';
import QueryBuilder from '../../builder/QueryBuilder';
import { BookingStateMachine } from './bookingStateMachine';
import { createPaystackCheckout } from '../../../helpers/paystackHelper';
import { Request } from 'express';
import { Payment } from '../payment/payment.model';
import { createCancellationRefundRecord } from '../payment/payment.service';
import { applyClientCancellationPenalty, applyProviderCancellationPenalty } from '../penalty/penalty.utils';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { USER_ROLES } from '../../../enum/user';

const STATUS_PERMISSIONS: Partial<Record<string, BOOKING_STATUS[]>> = {
  [USER_ROLES.PROVIDER]: [
    BOOKING_STATUS.ACCEPTED,
    BOOKING_STATUS.IN_PROGRESS,
    BOOKING_STATUS.COMPLETED_BY_PROVIDER,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.DISPUTED,
  ],
  [USER_ROLES.CLIENT]: [
    BOOKING_STATUS.CONFIRMED_BY_CLIENT,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.DISPUTED,
  ],
  [USER_ROLES.ADMIN]: Object.values(BOOKING_STATUS),
};

// Create a new booking and initialize Paystack checkout
const createBooking = async (user: JwtPayload, data: IBooking, req: Request) => {
  const service = await Service.findById(data.service).lean().exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the requested service. Please try selecting it again.');

  const provider = await User.findById(service.creator).lean().exec();
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'We\'re having trouble locating the service provider. Please try again in a moment.');

  const bookingDate = new Date(data.date);
  const now = new Date();

  // Validate if the selected date is in the past
  if (bookingDate < now) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please select a future date for your booking.');
  }

  // Validate if the selected day is among provider's available days
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const bookingDay = days[bookingDate.getDay()] as SERVICE_DAY;
  const availableDays = provider.providerDetails?.availableDay || [];

  if (availableDays.length > 0 && !availableDays.includes(bookingDay)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `The provider is not available on ${bookingDay.toUpperCase()}. Please choose a day that matches their schedule.`,
    );
  }

  const customer = await User.findById(user.id || user.authId)
    .lean()
    .exec();
  if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find your account details. Please ensure you are logged in correctly.');

  const booking = await Booking.create({
    customer: customer._id,
    provider: provider._id,
    service: service._id,
    date: data.date,
    location: data.location,
    address: data.address,
    specialNote: data.specialNote,
    bookingStatus: BOOKING_STATUS.CREATED,
  });

  const url = await createPaystackCheckout(
    req,
    service.price,
    {
      bookingId: booking._id.toString(),
      providerId: provider._id.toString(),
      serviceId: service._id.toString(),
      customerId: customer._id.toString(),
    },
    customer.email || 'customer@example.com',
  );

  await Booking.findByIdAndUpdate(booking._id, { transactionId: url.id });

  return url;
};

// Retrieve a list of bookings based on user role and query filters
const getBookings = async (user: JwtPayload, query: any, role: 'client' | 'provider' | 'admin') => {
  const userId = user.id || user.authId;
  let filter: any = { isDeleted: { $ne: true } };

  if (role === 'client') {
    filter.customer = userId;
  } else if (role === 'provider') {
    filter.provider = userId;
    filter.isPaid = true;
  }

  if (query.status) {
    const statusArray = (query.status as string).split(',').map(s => s.trim());
    filter.bookingStatus = { $in: statusArray };
    delete query.status;
  }

  const bookingQuery = new QueryBuilder(
    Booking.find(filter).populate([
      { path: 'customer', select: 'name image address contact whatsApp' },
      { path: 'provider', select: 'name image contact whatsApp providerDetails.category' },
      { path: 'service', select: 'name image price category subCategory' },
    ]),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await bookingQuery.modelQuery.lean().exec();
  const meta = await bookingQuery.getPaginationInfo();

  return { meta, data };
};

// Get a single booking's details by its ID
const getBookingById = async (id: string) => {
  const booking = await Booking.findById(id)
    .populate([
      { path: 'service', select: 'image price category subCategory' },
      { path: 'provider', select: 'name image address providerDetails.category contact whatsApp' },
      { path: 'customer', select: 'name image address contact whatsApp' },
    ])
    .lean()
    .exec();

  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the details for this booking.');
  return booking;
};

// Update booking information using its ID
const updateBooking = async (id: string, data: Partial<IBooking>) => {
  const booking = await Booking.findByIdAndUpdate(id, data, { new: true }).lean().exec();
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the details for this booking.');
  return booking;
};

// Transition booking status to CANCELLED and handle fees if applicable
const cancelBooking = async (user: JwtPayload, id: string, reason?: string) => {
  const role = user.role.toLowerCase() as 'client' | 'provider';
  const booking = await Booking.findById(id).populate('service').exec();
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the booking record in our system.');

  const originalPayment: any = await Payment.findOne({
    booking: booking._id,
    paymentStatus: PAYMENT_STATUS.PAID,
  }).lean();

  const originalAmount = originalPayment ? originalPayment.servicePrice || 0 : 0;
  let penaltyFee = 0;

  const currentStatus = booking.bookingStatus as BOOKING_STATUS;

  // Set cancellation details
  booking.cancelReason = reason || '';
  booking.cancelledBy = user.role.toUpperCase() as 'CLIENT' | 'PROVIDER';
  await booking.save();

  // No penalty if cancelled at the REQUESTED stage
  if (currentStatus === BOOKING_STATUS.REQUESTED) {
    if (originalAmount > 0) {
      await createCancellationRefundRecord(id, originalAmount, 0, 0);
      await refundPaystackTransaction(booking.transactionId, originalAmount);
    }
    await BookingStateMachine.transitionState(id, role, BOOKING_STATUS.CANCELLED, reason);
    return { message: 'Booking request cancelled successfully' };
  }

  if (role === 'client') {
    if (originalAmount > 0) {
      if (currentStatus === BOOKING_STATUS.ACCEPTED) {
        penaltyFee = originalAmount * 0.05;
      } else if (currentStatus === BOOKING_STATUS.IN_PROGRESS) {
        penaltyFee = originalAmount * 0.1;
      }

      await applyClientCancellationPenalty(
        booking._id.toString(),
        booking.transactionId,
        booking.customer.toString(),
        originalAmount,
        penaltyFee,
      );
    }

    await BookingStateMachine.transitionState(id, 'client', BOOKING_STATUS.CANCELLED, reason);
  } else {
    if (originalAmount > 0) {
      if (currentStatus === BOOKING_STATUS.ACCEPTED || currentStatus === BOOKING_STATUS.IN_PROGRESS) {
        penaltyFee = 30;
      }

      await applyProviderCancellationPenalty(
        booking._id.toString(),
        booking.transactionId,
        booking.provider.toString(),
        originalAmount,
        penaltyFee,
      );
    }

    await BookingStateMachine.transitionState(id, 'provider', BOOKING_STATUS.CANCELLED, reason);
  }

  return { message: 'Booking cancelled successfully' };
};

// Centralized status update logic with role-based validation
const updateBookingStatus = async (
  user: JwtPayload,
  id: string,
  status: BOOKING_STATUS,
  reason?: string,
) => {
  const role = user.role as string;
  const allowedStatuses = STATUS_PERMISSIONS[role] || [];

  let finalStatus = status;

  // If client confirms completion, move directly to SETTLED to trigger payout
  if (finalStatus === BOOKING_STATUS.CONFIRMED_BY_CLIENT) {
    finalStatus = BOOKING_STATUS.SETTLED;
  }

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      `You don't have permission to update this booking status to "${status}".`,
    );
  }

  // Handle Cancellation specially due to penalty logic
  if (finalStatus === BOOKING_STATUS.CANCELLED) {
    return await cancelBooking(user, id, reason);
  }

  // General transition for other statuses (ACCEPTED, IN_PROGRESS, COMPLETED, CONFIRMED, etc.)
  await BookingStateMachine.transitionState(id, role.toLowerCase() as any, finalStatus, reason);

  return { message: `Booking status updated to ${finalStatus} successfully` };
};

export const BookingService = {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  updateBookingStatus,
};
