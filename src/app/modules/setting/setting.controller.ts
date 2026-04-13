import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { SettingService } from './setting.service';

const updateSetting = catchAsync(async (req: Request, res: Response) => {
  const result = await SettingService.updateSetting(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Setting updated successfully',
    data: result,
  });
});

const getSetting = catchAsync(async (_req: Request, res: Response) => {
  const result = await SettingService.getSetting();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Setting fetched successfully',
    data: result,
  });
});

export const SettingController = {
  updateSetting,
  getSetting,
};
