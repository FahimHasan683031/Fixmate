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
    data: result,
  });
});

const downloadTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await TransactionService.downloadTransactions(req.query);

  res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.${result.fileExtension}"`);
  res.setHeader('Content-Type', result.contentType);
  
  res.send(result.buffer);
});

const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  const result = await TransactionService.getTransactionById(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Transaction retrieved successfully',
    data: result,
  });
});

export const TransactionController = {
  getAllTransactions,
  getTransactionById,
  downloadTransactions,
};
