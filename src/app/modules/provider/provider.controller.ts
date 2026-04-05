// Provider Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ProviderServices } from './provider.service';
import { CategoryController } from '../category/category.controller';
import { BookingController } from '../booking/booking.controller';
import { UserController } from '../user/user.controller';
import { VerificationController } from '../verification/verification.controller';
import { ServiceController } from '../service/service.controller';
import { PaymentControllers } from '../payment/payment.controller';

const provider = UserController.getProfile;
const providerProfileUpdate = UserController.updateProviderProfile;
const providerProfileDelete = UserController.deleteProfile;

// Controller to retrieve the dashboard data for the provider
const providerHome = catchAsync(async (req: Request, res: Response) => {
  const result = await ProviderServices.providerHome(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Provider home retrieved successfully',
    data: result,
  });
});

const providerVerification = VerificationController.getStatus;
const sendVerification = VerificationController.sendRequest;

const providerServices = ServiceController.getProviderServices;
const addService = ServiceController.addService;
const updateService = ServiceController.updateService;
const deleteService = ServiceController.deleteService;
const viewService = ServiceController.getServiceById;

const getBookings = BookingController.getBookings;

// Controller for the provider to see specific booking details
const seeBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await ProviderServices.seeBooking(req.user, req.params.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Booking details retrieved successfully',
    data: result,
  });
});

const getCategories = CategoryController.getCategories;

// Controller for the provider to retrieve a customer's basic profile
const getCustomer = catchAsync(async (req: Request, res: Response) => {
  const result = await ProviderServices.getCustomer(req.params.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Customer retrieved successfully',
    data: result,
  });
});

const updateBookingStatus = BookingController.updateBookingStatus;

const wallet = PaymentControllers.getWallet;
const withdraw = PaymentControllers.withdraw;
const getPaymentHistory = PaymentControllers.getPaymentHistory;

// Controller to fetch and list all ratings and reviews received by the provider
const ratings = catchAsync(async (req: Request, res: Response) => {
  const result = await ProviderServices.myReviews(req.user, req.query as any);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Successfully get reviews',
    data: result,
  });
});

export const ProviderControllers = {
  provider,
  providerHome,
  providerProfileUpdate,
  providerProfileDelete,
  providerVerification,
  sendVerification,
  providerServices,
  addService,
  deleteService,
  updateService,
  viewService,
  getBookings,
  seeBooking,
  getCategories,
  getCustomer,
  updateBookingStatus,
  wallet,
  withdraw,
  ratings,
  getPaymentHistory,
};
