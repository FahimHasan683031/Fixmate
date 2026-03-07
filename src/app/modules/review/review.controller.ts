import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ReviewService } from "./review.service";
import { StatusCodes } from 'http-status-codes'


// create review
const createReview = catchAsync(async (req, res) => {
  const payload = req.body
  const result = await ReviewService.createReview(payload)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Review created successfully',
    data: result,
  })
})

// get all reviews
const getAllReviews = catchAsync(async (req, res) => {
  const result = await ReviewService.getAllReviews(req.query)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Reviews retrieved successfully',
    data: result,
  })
})


// get single review
const getSingleReview = catchAsync(async (req, res) => {
  const id = req.params.id
  const result = await ReviewService.getSingleReview(id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Review retrieved successfully',
    data: result,
  })
})

// delete review
const deleteReview = catchAsync(async (req, res) => {
  const id = req.params.id
  const result = await ReviewService.deleteReview(id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Review deleted successfully',
  })
})


export const ReviewController = {
  createReview,
  getAllReviews,
  getSingleReview,
  deleteReview,
}
