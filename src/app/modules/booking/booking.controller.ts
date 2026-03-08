import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { BookingServices } from "./booking.service";

const createBooking = catchAsync(async (req: Request, res: Response) => {
    const result = await BookingServices.createBooking(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Booking created successfully",
        data: result,
    });
});

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
    const result = await BookingServices.getMyBookings(req.user, req.query);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Bookings retrieved successfully",
        data: result,
    });
});

const getSingleBooking = catchAsync(async (req: Request, res: Response) => {
    const result = await BookingServices.getSingleBooking(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Booking retrieved successfully",
        data: result,
    });
});

const updateBookingStatus = catchAsync(async (req: Request, res: Response) => {
    const { status, reason } = req.body;
    const result = await BookingServices.updateBookingStatus(req.user, req.params.id, status, reason);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: `Booking status updated to ${status}`,
        data: result,
    });
});

export const BookingControllers = {
    createBooking,
    getMyBookings,
    getSingleBooking,
    updateBookingStatus,
};
