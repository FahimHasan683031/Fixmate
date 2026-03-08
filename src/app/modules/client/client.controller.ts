import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ClientServices } from './client.service';
import { getSingleFilePath } from '../../../shared/getFilePath';

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await ClientServices.getUserProfile(req.user!);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: 'User profile retrieved successfully',
        data: result,
    });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
    if (req.body.longitude && req.body.latitude) {
        req.body.location = {
            type: 'Point',
            coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
        };
    }

    const result = await ClientServices.updateProfile(req.user!, req.body);


    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: 'Profile updated successfully',
        data: result,
    });
});

const deleteProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await ClientServices.deleteProfile(req.user!, req.body.password);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: 'Profile deleted successfully',
        data: result,
    });
});

export const ClientController = {
    getUserProfile,
    updateProfile,
    deleteProfile,
};
