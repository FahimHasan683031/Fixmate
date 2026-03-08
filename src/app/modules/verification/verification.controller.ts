import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { VerificationServices } from "./verification.service";
import { getSingleFilePath } from "../../../shared/getFilePath";

const sendVerificationRequest = catchAsync(async (req: Request, res: Response) => {
    const nidFront = getSingleFilePath(req.files, "nidFront");
    const nidBack = getSingleFilePath(req.files, "nidBack");
    const license = getSingleFilePath(req.files, "license");

    if (nidFront) req.body.nidFront = nidFront;
    if (nidBack) req.body.nidBack = nidBack;
    if (license) req.body.license = license;

    const result = await VerificationServices.sendVerificationRequest(req.user, req.body);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Verification request sent successfully",
        data: result,
    });
});

const getVerificationStatus = catchAsync(async (req: Request, res: Response) => {
    const result = await VerificationServices.getVerificationStatus(req.user);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Verification status retrieved successfully",
        data: result,
    });
});

const getAllVerificationRequests = catchAsync(async (req: Request, res: Response) => {
    const result = await VerificationServices.getAllVerificationRequests(req.query as any);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Verification requests retrieved successfully",
        data: result,
    });
});

const approveOrRejectRequest = catchAsync(async (req: Request, res: Response) => {
    const result = await VerificationServices.approveOrRejectRequest(req.params.id, req.params.status as any);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: `Verification request ${req.params.status} successfully`,
        data: result,
    });
});

export const VerificationControllers = {
    sendVerificationRequest,
    getVerificationStatus,
    getAllVerificationRequests,
    approveOrRejectRequest,
};
