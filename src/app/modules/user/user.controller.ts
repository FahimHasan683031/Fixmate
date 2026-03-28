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

// Controller to process profile updates and location data
const updateProfile = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.image = image;

  if (req.body.longitude && req.body.latitude) {
    req.body.location = {
      type: 'Point',
      coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
    };
  }

  const result = await UserService.updateProfile(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
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

export const UserController = {
  getProfile,
  updateProfile,
  deleteProfile,
};
