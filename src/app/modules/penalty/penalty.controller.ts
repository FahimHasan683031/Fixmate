import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { PenaltyService } from './penalty.service';

const createPenaltyByAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PenaltyService.createPenaltyByAdmin(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Penalty created successfully',
    data: result,
  });
});

const getAllPenalties = catchAsync(async (req: Request, res: Response) => {
  const result = await PenaltyService.getAllPenalties(req.query as any);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Penalties retrieved successfully',
    data: result,
  });
});

const getMyPenalties = catchAsync(async (req: Request, res: Response) => {
  const result = await PenaltyService.getMyPenalties(req.user as any, req.query as any);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My penalties retrieved successfully',
    data: result,
  });
});

const downloadPenalties = catchAsync(async (req: Request, res: Response) => {
  const result = await PenaltyService.downloadPenalties(req.query);

  res.setHeader('Content-Disposition', `attachment; filename="penalties_${Date.now()}.${result.fileExtension}"`);
  res.setHeader('Content-Type', result.contentType);
  
  res.send(result.buffer);
});

const getPenaltyById = catchAsync(async (req: Request, res: Response) => {
  const result = await PenaltyService.getPenaltyById(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Penalty retrieved successfully',
    data: result,
  });
});

export const PenaltyController = {
  createPenaltyByAdmin,
  getAllPenalties,
  getMyPenalties,
  getPenaltyById,
  downloadPenalties,
};
