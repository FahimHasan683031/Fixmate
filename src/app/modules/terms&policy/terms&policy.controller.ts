// Terms&policy Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { TermsAndPolicyService } from './terms&policy.service';

// Controller to fetch the terms and conditions
const getTerms = catchAsync(async (_req: Request, res: Response) => {
  const result = await TermsAndPolicyService.getTerms();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Terms retrieved successfully',
    data: result,
  });
});

// Controller to fetch the privacy policy
const getPolicy = catchAsync(async (_req: Request, res: Response) => {
  const result = await TermsAndPolicyService.getPolicy();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Policy retrieved successfully',
    data: result,
  });
});

// Controller to create or update terms and conditions (Admin only)
const upsertTerms = catchAsync(async (req: Request, res: Response) => {
  const result = await TermsAndPolicyService.upsertTerms(req.body.content);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Terms updated successfully',
    data: result,
  });
});

// Controller to create or update privacy policy (Admin only)
const upsertPolicy = catchAsync(async (req: Request, res: Response) => {
  const result = await TermsAndPolicyService.upsertPolicy(req.body.content);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Policy updated successfully',
    data: result,
  });
});

export const TermsAndPolicyController = {
  getTerms,
  getPolicy,
  upsertTerms,
  upsertPolicy,
};
