// Booking Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { BookingService } from './booking.service';

// Controller to handle new booking creation
const createBooking = catchAsync(async (req: Request | any, res: Response) => {
  const result = await BookingService.createBooking(req.user, req.body, req);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Booking created successfully',
    data: result,
  });
});

// Controller to fetch bookings for the current user
const getBookings = catchAsync(async (req: Request | any, res: Response) => {
  const role = req.user.role.toLowerCase() as 'client' | 'provider' | 'admin';
  const result = await BookingService.getBookings(req.user, req.query, role);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Bookings retrieved successfully',
    data: result,
  });
});

// Controller to get details of a specific booking
const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getBookingById(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Booking retrieved successfully',
    data: result,
  });
});

// Controller to update a booking's status (Accept, Reject, Cancel, Start, Complete, etc.)
const updateBookingStatus = catchAsync(async (req: Request | any, res: Response) => {
  const { status, reason } = req.body;
  const result = await BookingService.updateBookingStatus(req.user, req.params.id, status, reason);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result,
  });
});

export const BookingController = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
};
