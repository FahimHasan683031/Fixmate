import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { Request, Response } from "express";
import { getSingleFilePath } from "../../../shared/getFilePath";
import { SupportService } from "./support.service";

const createSupport = catchAsync(async (req: Request, res: Response) => {
    const image = getSingleFilePath(req.files, "image");
    if (image) req.body.attachment = image;

    const result = await SupportService.createSupport(req.user, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Support created successfully",
        data: result,
    });
});

const getSupports = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getSupports(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Supports fetched successfully",
        data: result,
    });
});

const markAsResolve = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.markAsResolve(req.user, req.params.id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Support resolved successfully",
        data: result,
    });
});

export const SupportController = {
    createSupport,
    getSupports,
    markAsResolve
};
