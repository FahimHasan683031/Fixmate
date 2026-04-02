import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { TransactionService } from './transaction.service';

const getAllTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await TransactionService.getAllTransactions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Transactions retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const TransactionController = {
  getAllTransactions,
};
