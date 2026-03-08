import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { TermsAndPolicyServices } from "./terms&policy.service";

const getTerms = catchAsync(async (req: Request, res: Response) => {
    const result = await TermsAndPolicyServices.getTerms();
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Terms retrieved successfully",
        data: result,
    });
});

const getPolicy = catchAsync(async (req: Request, res: Response) => {
    const result = await TermsAndPolicyServices.getPolicy();
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Policy retrieved successfully",
        data: result,
    });
});

const upsertTerms = catchAsync(async (req: Request, res: Response) => {
    const { content } = req.body;
    const result = await TermsAndPolicyServices.upsertTerms(content);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Terms updated successfully",
        data: result,
    });
});

const upsertPolicy = catchAsync(async (req: Request, res: Response) => {
    const { content } = req.body;
    const result = await TermsAndPolicyServices.upsertPolicy(content);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Policy updated successfully",
        data: result,
    });
});

export const TermsAndPolicyControllers = {
    getTerms,
    getPolicy,
    upsertTerms,
    upsertPolicy,
};
