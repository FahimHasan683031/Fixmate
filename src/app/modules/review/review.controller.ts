// Review Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ReviewService } from './review.service';

// Controller to handle the submission of a new review
const createReview = catchAsync(async (req: Request | any, res: Response) => {
  const result = await ReviewService.createReview(req.user, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Review created successfully',
    data: result,
  });
});

// Controller to fetch reviews associated with a provider ID
const getReviewsByProvider = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getReviewsByProvider(req.params.providerId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Provider reviews retrieved successfully',
    data: result,
  });
});

// Controller to fetch reviews associated with a service ID
const getReviewsByService = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getReviewsByService(req.params.serviceId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service reviews retrieved successfully',
    data: result,
  });
});

export const ReviewController = {
  createReview,
  getReviewsByProvider,
  getReviewsByService,
};
