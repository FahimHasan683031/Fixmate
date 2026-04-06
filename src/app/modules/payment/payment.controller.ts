// Payment Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PaymentServices } from './payment.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';

// Controller to create provider transfer recipient
const generateRecipient = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.generateRecipient(req);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Transfer recipient generated successfully',
    data: result,
  });
});

// Webhook entry point for payment updates
const webhook = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.webhook(req);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Webhook processed',
    data: result,
  });
});

// Retrieve current user's wallet info
const getWallet = catchAsync(async (req: Request | any, res: Response) => {
  const result = await PaymentServices.getWallet(req.user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Wallet statistics retrieved successfully',
    data: result,
  });
});

// Retrieve current user's payment history
const getPaymentHistory = catchAsync(async (req: Request | any, res: Response) => {
  const result = await PaymentServices.getPaymentHistory(req.user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Payment history retrieved successfully',
    data: result,
  });
});

// Get detailed breakdown of a single payment
const getPaymentDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.getPaymentDetails(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Payment details retrieved successfully',
    data: result,
  });
});

// Process withdrawal request from provider
const withdraw = catchAsync(async (req: Request | any, res: Response) => {
  const result = await PaymentServices.withdraw(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Withdrawal initiated successfully',
    data: result,
  });
});

const downloadPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.downloadPayments(req.query);

  res.setHeader('Content-Disposition', `attachment; filename="payments_${Date.now()}.${result.fileExtension}"`);
  res.setHeader('Content-Type', result.contentType);

  res.send(result.buffer);
});

// Dedicated controller to initiate booking payment
const checkoutBooking = catchAsync(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  if (!bookingId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please provide a valid booking ID to proceed with the payment.');
  }
  
  const result = await PaymentServices.checkoutBooking(req, bookingId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Booking checkout initialized successfully',
    data: result,
  });
});

export const PaymentControllers = {
  generateRecipient,
  webhook,
  getWallet,
  getPaymentHistory,
  getPaymentDetails,
  withdraw,
  downloadPayments,
  checkoutBooking,
};
