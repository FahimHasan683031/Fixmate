import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { SubscriptionService } from './subscription.service';


const verifyReceipt = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.verifyReceipt(req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription successfully verified and activated',
    data: result,
  });
});

const handleAppleWebhook = catchAsync(async (req: Request, res: Response) => {
  // Apple sends the JWS token inside an object like { signedPayload: "..." }
  await SubscriptionService.handleAppleWebhook(req.body.signedPayload);
  
  // Apple expects a 200 OK response unconditionally if received successfully
  res.status(200).send('OK');
});

const handleGoogleWebhook = catchAsync(async (req: Request, res: Response) => {
  await SubscriptionService.handleGoogleWebhook(req.body);
  
  // Google expects a 200 OK response
  res.status(200).send('OK');
});

export const SubscriptionController = {
  verifyReceipt,
  handleAppleWebhook,
  handleGoogleWebhook,
};
