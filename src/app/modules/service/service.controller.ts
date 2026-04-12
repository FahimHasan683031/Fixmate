// Service Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ServiceService } from './service.service';
import { getSingleFilePath } from '../../../shared/getFilePath';

// Controller to handle the addition of a new service
const addService = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.image = image;

  const result = await ServiceService.addService(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service added successfully',
    data: result,
  });
});

// Controller to handle service information updates
const updateService = catchAsync(async (req: Request | any, res: Response) => {
  const image = getSingleFilePath(req.files, 'image');
  if (image) req.body.image = image;

  const result = await ServiceService.updateService(req.params.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service updated successfully',
    data: result,
  });
});

// Controller to handle service deletion
const deleteService = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.deleteService(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service deleted successfully',
    data: result,
  });
});

// Controller to fetch services for the current provider
const getHomeServices = catchAsync(async (req: Request | any, res: Response) => {
  const result = await ServiceService.getHomeServices(req.user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Provider services retrieved successfully',
    data: result,
  });
});

// Controller to list all services with filtering options
const getServices = catchAsync(async (req: Request | any, res: Response) => {
  const result = await ServiceService.getServices(req.user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Services retrieved successfully',
    data: result,
  });
});

// Controller to get a specific service's data
const getServiceById = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceService.getServiceById(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service retrieved successfully',
    data: result,
  });
});

const toggleServiceSuspension = catchAsync(async (req: Request, res: Response) => {
  const { isSuspended } = req.body;
  const result = await ServiceService.toggleServiceSuspension(req.params.id, isSuspended);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: `Service ${isSuspended ? 'suspended' : 'unsuspended'} successfully`,
    data: result,
  });
});

export const ServiceController = {
  addService,
  updateService,
  deleteService,
  getHomeServices,
  getServices,
  getServiceById,
  toggleServiceSuspension,
};
