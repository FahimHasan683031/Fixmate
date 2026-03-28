// Payment Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PaymentServices } from './payment.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';

// Handle payment success callback
const success = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.success(req.query);
  res.send(result);
});

// Handle payment failure case
const failure = catchAsync(async (_req: Request, res: Response) => {
  res.send(`
    <html>
        <body>
            <h1 style="color: red;">Payment Failed!</h1>
            <p>There was an error processing your payment. Please try again.</p>
        </body>
    </html>
    `);
});

// Controller to create provider connected account
const createConnectedAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.createConnectedAccount(req);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Connected account created successfully',
    data: result,
  });
});

// Controller for successful account connection message
const successAccount = catchAsync(async (_req: Request, res: Response) => {
  const result = await PaymentServices.successAccount(_req);
  res.send(result);
});

// Controller to refresh account status
const refreshAccount = catchAsync(async (_req: Request, res: Response) => {
  const result = await PaymentServices.refreshAccount(_req);
  res.send(result);
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

export const PaymentControllers = {
  success,
  failure,
  createConnectedAccount,
  successAccount,
  refreshAccount,
  webhook,
  getWallet,
  getPaymentHistory,
  getPaymentDetails,
  withdraw,
};
