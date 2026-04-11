// Verification Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { VerificationService } from './verification.service';
import { getSingleFilePath } from '../../../shared/getFilePath';

// Controller to handle the submission of verification documents (NID, License)
const sendRequest = catchAsync(async (req: Request | any, res: Response) => {
  const nid = getSingleFilePath(req.files, 'nid');
  const license = getSingleFilePath(req.files, 'license');

  if (nid) req.body.nid = nid;
  if (license) req.body.license = license;

  const result = await VerificationService.sendRequest(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification request sent successfully',
    data: result,
  });
});

// Controller to fetch the provider's current verification status
const getStatus = catchAsync(async (req: Request | any, res: Response) => {
  const result = await VerificationService.getStatus(req.user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification status retrieved successfully',
    data: result,
  });
});

// Controller to list all verification requests for the admin panel
const getAllRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.getAllRequests(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification requests retrieved successfully',
    data: result,
  });
});

// get single verification request
const getSingleRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await VerificationService.getSingleRequest(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Verification request retrieved successfully',
    data: result,
  });
});

// Controller for admins to approve or reject a verification request
const updateStatus = catchAsync(async (req: Request, res: Response) => {
  console.log("hita controller ...")
  const result = await VerificationService.updateStatus(req.params.id, req.body.status);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: `Verification request ${req.body.status} successfully`,
    data: result,
  });
});

export const VerificationController = {
  sendRequest,
  getStatus,
  getAllRequests,
  getSingleRequest,
  updateStatus,
};
