import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ServiceServices } from "./service.service";
import { getSingleFilePath } from "../../../shared/getFilePath";

const createService = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.image = image;

    const result = await ServiceServices.createService(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Service created successfully",
        data: result,
    });
});

const getAllServices = catchAsync(async (req: Request, res: Response) => {
    const result = await ServiceServices.getAllServices(req.query as any);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Services retrieved successfully",
        data: result,
    });
});

const getSingleService = catchAsync(async (req: Request, res: Response) => {
    const result = await ServiceServices.getSingleService(req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Service retrieved successfully",
        data: result,
    });
});

const updateService = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.image = image;

    const result = await ServiceServices.updateService(req.user, req.params.id, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Service updated successfully",
        data: result,
    });
});

const deleteService = catchAsync(async (req: Request, res: Response) => {
    const result = await ServiceServices.deleteService(req.user, req.params.id);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Service deleted successfully",
        data: result,
    });
});

export const ServiceControllers = {
    createService,
    getAllServices,
    getSingleService,
    updateService,
    deleteService
};
