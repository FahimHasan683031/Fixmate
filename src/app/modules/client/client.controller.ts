import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ClientServices } from "./client.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { getSingleFilePath } from "../../../shared/getFilePath";

const getUserProfile = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getUserProfile(req.user);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "User profile retrieved successfully",
        data: result,
    });
});

const updateProfile = catchAsync(async (req: Request | any, res: Response) => {
    const image = getSingleFilePath(req.files, "image");

    if (image) req.body.image = image;

    if (req.body.longitude && req.body.latitude) req.body.location = { type: "Point", coordinates: [Number(req.body.longitude), Number(req.body.latitude)] };

    const result = await ClientServices.updateProfile(req.user, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Profile updated successfully",
        data: result,
    });
});

const deleteProfile = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.deleteProfile(req.user, req.body.password);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Profile deleted successfully",
        data: result,
    });
});

const getServices = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getServices(req.user, req.query);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Services retrieved successfully",
        data: result,
    });
});

const getProviderById = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getProviderById(req.user, req.params.id as any, req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Provider retrieved successfully",
        data: result,
    });
});

const getFavorites = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getFavorites(req.user, req.query);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Favorites retrieved successfully",
        data: result,
    });
});

const addFavorite = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.addFavorite(req.user, req.params.id as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,//@ts-ignore
        message: result?.message ? result.message : "Favorite added successfully",
        data: result,
    });
});

const removeFavorite = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.removeFavorite(req.user, req.params.id as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Favorite removed successfully",
        data: result,
    });
});

const createBooking = catchAsync(async (req: Request | any, res: Response) => {
    if (req.body.longitude && req.body.latitude) req.body.location = { type: "Point", coordinates: [Number(req.body.longitude), Number(req.body.latitude)] };

    const result = await ClientServices.sendBooking(req.user, req.body, req);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully create Booking",
        data: result,
    });
});

const updateBooking = catchAsync(async (req: Request | any, res: Response) => {
    if (req.body.longitude && req.body.latitude) req.body.location = { type: "Point", coordinates: [Number(req.body.longitude), Number(req.body.latitude)] };

    const result = await ClientServices.updateBooking(req.user, req.params.id as any, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully update Booking",
        data: result,
    });
});

const cancelBooking = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.cancelBooking(req.user, req.params.id as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully cancel Booking",
        data: result,
    });
});

const getBookings = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getBookings(req.user, req.query as any, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Bookings retrieved successfully",
        data: result,
    });
});

const bookScreen = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.bookScreen(req.params.id, req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Bookings screen retrieved successfully",
        data: result,
    });
});

const seeBooking = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.seeBooking(req.user, req.params.id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Bookings screen retrieved successfully",
        data: result,
    });
});

const getCategories = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.getCategories(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Categories retrieved successfully",
        data: result,
    });
});

const acceptBooking = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.acceptBooking(req.user, req.params.id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully accept Booking",
        data: result,
    });
});

const giveReview = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ClientServices.giveReview(req.user, req.params.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully give Review",
        data: result,
    });
});

const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
    const result = await ClientServices.walteHistory(req.user, req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully get payment history!",
        data: result,
    });
});

const getPaymentInfo = catchAsync(async (req: Request, res: Response) => {
    const result = await ClientServices.paymentHistoryPage(req.params.id!);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully get a payment data!",
        data: result,
    });
});

export const ClientControllers = {
    getUserProfile,
    updateProfile,
    deleteProfile,
    getServices,
    getProviderById,
    getFavorites,
    addFavorite,
    removeFavorite,
    createBooking,
    updateBooking,
    cancelBooking,
    getBookings,
    bookScreen,
    seeBooking,
    getCategories,
    acceptBooking,
    giveReview,
    getPaymentHistory,
    getPaymentInfo,
};
