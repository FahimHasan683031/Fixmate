import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { DisputeService } from './dispute.service';

const createDispute = catchAsync(async (req: Request | any, res: Response) => {
  const result = await DisputeService.createDispute(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Dispute raised successfully',
    data: result,
  });
});

const getAllDisputes = catchAsync(async (req: Request, res: Response) => {
  const result = await DisputeService.getAllDisputes(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Disputes retrieved successfully',
    data: result,
  });
});

const getDisputeById = catchAsync(async (req: Request, res: Response) => {
  const result = await DisputeService.getDisputeById(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Dispute retrieved successfully',
    data: result,
  });
});

const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const result = await DisputeService.resolveDispute(req.params.id, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Dispute resolved successfully',
    data: result,
  });
});


export const DisputeController = {
  createDispute,
  getAllDisputes,
  getDisputeById,
  resolveDispute,
};
