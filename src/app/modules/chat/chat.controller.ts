// Chat Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChatServices } from './chat.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';

// Controller to create or access a chat room
const create = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatServices.create(req.user, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Chat created successfully',
    data: result,
  });
});

// Controller to retrieve a single chat room's information
const getOneRoom = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatServices.getById(req.params.id, req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chat retrieved successfully',
    data: result,
  });
});

// Controller to fetch all active chats for the logged-in user
const getAllChats = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatServices.allChats(req.user, req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "All Chat's retrieved successfully",
    data: result,
  });
});

// Controller to remove a specific chat room
const deleteOnChat = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatServices.deleteOneChat(req.user, req.params.id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Chat delete successfully',
    data: result,
  });
});

export const ChatControllers = {
  create,
  getOneRoom,
  getAllChats,
  deleteOnChat,
};
