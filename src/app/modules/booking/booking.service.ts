// Booking Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IBooking } from './booking.interface';
import { Booking } from './booking.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import { Service } from '../service/service.model';
import { User } from '../user/user.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { BookingStateMachine } from './bookingStateMachine';
import { createPaystackCheckout, refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { Request } from 'express';
import { createCancellationRefundRecord } from '../payment/payment.service';
import { Payment } from '../payment/payment.model';

// Create a new booking and initialize Paystack checkout
const createBooking = async (user: JwtPayload, data: IBooking, req: Request) => {
  const service = await Service.findById(data.service).lean().exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'Service not found!');

  const provider = await User.findById(service.creator).lean().exec();
  if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, 'Provider not found!');

  const customer = await User.findById(user.id || user.authId)
    .lean()
    .exec();
  if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, 'Customer not found!');

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
    filter.bookingStatus = query.status;
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

  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');
  return booking;
};

// Update booking information using its ID
const updateBooking = async (id: string, data: Partial<IBooking>) => {
  const booking = await Booking.findByIdAndUpdate(id, data, { new: true }).lean().exec();
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');
  return booking;
};

// Transition booking status to CANCELLED and handle fees if applicable
const cancelBooking = async (_user: JwtPayload, id: string, role: 'client' | 'provider') => {
  const booking = await Booking.findById(id).populate('service').lean().exec();
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');

  const originalPayment: any = await Payment.findOne({
    booking: booking._id,
    paymentStatus: 'CLIENT_PAID',
  }).lean();

  const originalAmount = originalPayment
    ? originalPayment.servicePrice || 0
    : 0;
  let refundedAmount = originalAmount;
  let penaltyFee = 0;

  const currentStatus = booking.bookingStatus as BOOKING_STATUS;

  if (role === 'client') {
    if (originalAmount > 0) {
      // Basic penalty rules (can be expanded based on business logic)
      if (currentStatus === BOOKING_STATUS.ACCEPTED) {
        penaltyFee = originalAmount * 0.1; // 10% penalty for late client cancellation
      } else if (currentStatus === BOOKING_STATUS.IN_PROGRESS) {
        penaltyFee = originalAmount * 0.5; // 50% penalty if job already started
      }
      refundedAmount = originalAmount - penaltyFee;

      await createCancellationRefundRecord(
        booking._id.toString(),
        refundedAmount,
      );

      if (refundedAmount > 0) {
        await refundPaystackTransaction(booking.transactionId, refundedAmount);
      }

      if (penaltyFee > 0) {
        await User.findByIdAndUpdate(booking.provider, {
          $inc: { 'providerDetails.wallet': penaltyFee },
        });
      }
    }

    await BookingStateMachine.transitionState(id, 'client', BOOKING_STATUS.CANCELLED);
  } else {
    // Provider cancels
    if (originalAmount > 0) {
      penaltyFee = originalAmount * 0.05; // 5% penalty deduction for provider bailing out
      const providerDeduction = penaltyFee;
      refundedAmount = originalAmount; // Client gets full refund

      await createCancellationRefundRecord(
        booking._id.toString(),
        refundedAmount,
      );

      await User.findByIdAndUpdate(booking.provider, {
        $inc: { 'providerDetails.wallet': -providerDeduction },
      });

      if (refundedAmount > 0) {
        await refundPaystackTransaction(booking.transactionId, refundedAmount);
      }
    }

    await BookingStateMachine.transitionState(id, 'provider', BOOKING_STATUS.CANCELLED);
  }

  return { message: 'Booking cancelled successfully' };
};

// Dispute a booking with a reason
const disputeBooking = async (user: JwtPayload, id: string, reason: string) => {
  const booking = await Booking.findById(id).lean().exec();
  if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found!');

  const userId = user.id || user.authId;
  if (booking.customer.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to dispute this booking!');
  }

  await BookingStateMachine.transitionState(id, 'client', BOOKING_STATUS.DISPUTED);
  const updatedBooking = await Booking.findByIdAndUpdate(
    id,
    { disputeReason: reason, disputedAt: new Date() },
    { new: true },
  )
    .lean()
    .exec();

  return updatedBooking;
};

export const BookingService = {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  disputeBooking,
};
