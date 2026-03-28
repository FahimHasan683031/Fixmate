// HelpAndSupport Controller
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { SupportServices } from './support.service';
import { Request, Response } from 'express';
import { getSingleFilePath } from '../../../shared/getFilePath';

// Controller to handle the creation of a new support request with optional attachments
const createSupport = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.attachment = image;

  const result = await SupportServices.createSupport(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Support created successfully',
    data: result,
  });
});

// Controller to retrieve all support tickets for administrative review
const getSupports = catchAsync(async (req: Request | any, res: Response) => {
  const result = await SupportServices.getSupports(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Supports fetched successfully',
    data: result,
  });
});

// Controller to mark a support ticket as resolved
const markAsResolve = catchAsync(async (req: Request | any, res: Response) => {
  const result = await SupportServices.markAsResolve(req.user, req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Support given successfully',
    data: result,
  });
});

export const SupportControllers = {
  createSupport,
  getSupports,
  markAsResolve,
};
