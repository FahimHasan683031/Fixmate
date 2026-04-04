// User Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { getSingleFilePath } from '../../../shared/getFilePath';

// Controller to fetch the logged-in user's profile
const getProfile = catchAsync(async (req: Request | any, res: Response) => {
  const result = await UserService.getProfile(req.user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

// Controller to process standard user profile updates
const updateUserProfile = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.image = image;

  if (req.body.longitude && req.body.latitude) {
    req.body.location = {
      type: 'Point',
      coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
    };
  }

  const result = await UserService.updateUserProfile(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: result,
  });
});

// Controller to process provider profile updates
const updateProviderProfile = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.image = image;

  if (req.body.longitude && req.body.latitude) {
    req.body.location = {
      type: 'Point',
      coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
    };
  }

  const result = await UserService.updateProviderProfile(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Provider profile updated successfully',
    data: result,
  });
});

// Controller to handle account deletion requests
const deleteProfile = catchAsync(async (req: Request | any, res: Response) => {
  const result = await UserService.deleteProfile(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile deleted successfully',
    data: result,
  });
});

const downloadUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.downloadUsers(req.query);

  res.setHeader('Content-Disposition', `attachment; filename="users_${Date.now()}.${result.fileExtension}"`);
  res.setHeader('Content-Type', result.contentType);
  
  res.send(result.buffer);
});

// Controller to list users with filtering
const getUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUsers(req.query as any);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Users retrieved successfully',
    data: result,
  });
});

// Controller to get a single user's detail
const getUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUser(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User retrieved successfully',
    data: result,
  });
});

// Controller to change user status (block/unblock/delete)
const blockAndUnblockUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.blockAndUnblockUser(req.params.id, req.params.status as any);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: `User ${req.params.status}ed successfully`,
    data: result,
  });
});

export const UserController = {
  getProfile,
  updateUserProfile,
  updateProviderProfile,
  deleteProfile,
  downloadUsers,
  getUsers,
  getUser,
  blockAndUnblockUser,
};
