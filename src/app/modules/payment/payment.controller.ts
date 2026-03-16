import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { PaymentServices } from "./payment.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

const success = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.success(req.query);
  res.send(result);
});

const failure = catchAsync(async (req: Request, res: Response) => {
  res.send(`
    <html>
        <body>
            <h1 style="color: red;">Payment Failed!</h1>
            <p>There was an error processing your payment. Please try again.</p>
        </body>
    </html>
    `);
});

const createConnectedAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.createConnectedAccount(req);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Connected account created successfully",
    data: result
  });
});

const successAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.successAccount(req);
  res.send(result);
});

const refreshAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.refreshAccount(req);
  res.send(result);
});

const webhook = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.webhook(req);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Webhook processed",
    data: result
  });
});

export const PaymentControllers = {
  success,
  failure,
  createConnectedAccount,
  successAccount,
  refreshAccount,
  webhook
};
