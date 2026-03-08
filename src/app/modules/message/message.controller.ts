import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { MessageServices } from "./message.service";
import { Request, Response } from "express";
import { getSingleFilePath } from "../../../shared/getFilePath";

const create = catchAsync(async (req: Request, res: Response) => {
  const image = getSingleFilePath(req.files, "image");

  if (image) req.body.image = image;

  const result = await MessageServices.create(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Message created successfully",
    data: result,
  });
});

const messagesOfChat = catchAsync(async (req: Request, res: Response) => {
  const result = await MessageServices.messagesOfChat(req.user, req.query, req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Messages of chat retrieved successfully",
    data: result,
  });
});

const updateMessage = catchAsync(async (req: Request, res: Response) => {
  const image = getSingleFilePath(req.files, "image");

  if (image) req.body.image = image;

  const result = await MessageServices.updateMessage(req.user, req.params.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Message updated successfully",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await MessageServices.deleteMessage(req.user, req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Message delete Successfully",
    data: result,
  });
});

export const MessageControllers = {
  create,
  messagesOfChat,
  updateMessage,
  deleteMessage
};
