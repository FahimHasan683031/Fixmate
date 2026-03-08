import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { getSingleFilePath } from "../../../shared/getFilePath";
import { ProviderServices } from "./provider.service";

const profile = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.profile(req.user);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Provider retrieved successfully",
        data: result,
    });
});

const profileUpdate = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.image = image;

    if (req.body.longitude && req.body.latitude) {
        req.body.location = {
            type: "Point",
            coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
        };
    }

    const result = await ProviderServices.profileUpdate(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Provider updated successfully",
        data: result,
    });
});

const verificaitonStatusCheck = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.verificaitonStatusCheck(req.user);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully get verification info",
        data: result,
    });
});

const sendVerificaitonRequest = catchAsync(async (req: Request, res: Response) => {
    const nidFront = getSingleFilePath(req.files, "nidFront");
    const nidBack = getSingleFilePath(req.files, "nidBack");
    const license = getSingleFilePath(req.files, "license");

    if (nidFront) req.body.nidFront = nidFront;
    if (nidBack) req.body.nidBack = nidBack;
    if (license) req.body.license = license;

    const result = await ProviderServices.sendVerificaitonRequest(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully sent verification request",
        data: result,
    });
});

const providerServices = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.providerServices(req.user, req.query as any);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully retrieved provider services",
        data: result,
    });
});

const addService = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.image = image;

    const result = await ProviderServices.addService(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully added service",
        data: result,
    });
});

const deleteService = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.deleteService(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully deleted service",
        data: result,
    });
});

const updateService = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.image = image;

    const result = await ProviderServices.updateService(req.user, req.params.id, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully updated service",
        data: result,
    });
});

const viewService = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.viewService(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully retrieved service",
        data: result,
    });
});

const getBookings = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.getBookings(req.user, req.query, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Bookings retrieved successfully",
        data: result,
    });
});

const actionBooking = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.actionBooking(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Booking action successful",
        data: result,
    });
});

const seeBooking = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.seeBooking(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Booking retrieved successfully",
        data: result,
    });
});

const getCategories = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.getCategories(req.query as any);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Categories retrieved successfully",
        data: result,
    });
});

const getCustomer = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.getCustomer(req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Customer retrieved successfully",
        data: result,
    });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.cancelBooking(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Booking cancelled successfully",
        data: result,
    });
});

const wallet = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.wallet(req.user, req.query);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Wallet retrieved successfully",
        data: result,
    });
});

const withdrawal = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.withdrawal(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Withdrawal successful",
        data: result,
    });
});

const ratings = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.myReviews(req.user, req.query);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully retrieved reviews",
        data: result,
    });
});

const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
    const result = await ProviderServices.walletHistory(req.user, req.query);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully retrieved payment history",
        data: result,
    });
});

export const ProviderControllers = {
    profile,
    profileUpdate,
    verificaitonStatusCheck,
    sendVerificaitonRequest,
    providerServices,
    addService,
    deleteService,
    updateService,
    viewService,
    getBookings,
    actionBooking,
    seeBooking,
    getCategories,
    getCustomer,
    cancelBooking,
    wallet,
    withdrawal,
    ratings,
    getPaymentHistory,
};
