// Client Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ClientServices } from './client.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { CategoryController } from '../category/category.controller';
import { BookingController } from '../booking/booking.controller';
import { UserController } from '../user/user.controller';
import { ServiceController } from '../service/service.controller';
import { FavoritesController } from '../favorites/favorites.controller';
import { ReviewController } from '../review/review.controller';
import { PaymentControllers } from '../payment/payment.controller';

const getUserProfile = UserController.getProfile;
const updateProfile = UserController.updateUserProfile;
const deleteProfile = UserController.deleteProfile;

const getServices = ServiceController.getServices;

// Controller to get a provider's full profile for a client
const getProviderById = catchAsync(async (req: Request | any, res: Response) => {
  const result = await ClientServices.getProviderById(
    req.user,
    req.params.id as any,
    req.query as any,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Provider retrieved successfully',
    data: result,
  });
});

const createBooking = BookingController.createBooking;

// Controller to update an existing booking's data
const updateBooking = catchAsync(async (req: Request | any, res: Response) => {
  if (req.body.longitude && req.body.latitude)
    req.body.location = {
      type: 'Point',
      coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
    };

  const result = await ClientServices.updateBooking(req.user, req.params.id as any, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Successfully update Booking',
    data: result,
  });
});
const getBookings = BookingController.getBookings;

const bookScreen = ServiceController.getServiceById;

// Controller to view specific details of a booking
const seeBooking = catchAsync(async (req: Request | any, res: Response) => {
  const result = await ClientServices.seeBooking(req.user, req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Bookings screen retrieved successfully',
    data: result,
  });
});

const getCategories = CategoryController.getCategories;

const removeFavorite = FavoritesController.removeFavorite;
const getFavorites = FavoritesController.getFavorites;

const giveReview = ReviewController.createReview;

const updateBookingStatus = BookingController.updateBookingStatus;

const getPaymentHistory = PaymentControllers.getPaymentHistory;
const getPaymentHistoryPage = PaymentControllers.getPaymentDetails;

export const ClientControllers = {
  getUserProfile,
  updateProfile,
  deleteProfile,
  getServices,
  getProviderById,
  getFavorites,
  removeFavorite,
  createBooking,
  updateBooking,
  updateBookingStatus,
  getBookings,
  bookScreen,
  seeBooking,
  getCategories,
  giveReview,
  getPaymentHistory,
  getPaymentHistoryPage,
};
