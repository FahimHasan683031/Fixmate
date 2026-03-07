import QueryBuilder from '../../builder/QueryBuilder'
import { IReview } from './review.interface'
import { Review } from './review.model'

// create review
const createReview = async (payload: IReview) => {
  console.log(payload)
  const result = await Review.create(payload)
  return result
}

// get all reviews
const getAllReviews = async (query: Record<string, unknown>) => {
  const reviewQueryBuilder = new QueryBuilder(Review.find(), query)
    .filter()
    .sort()
    .fields()
    .paginate()

  const reviews = await reviewQueryBuilder.modelQuery
  const paginationInfo = await reviewQueryBuilder.getPaginationInfo()

  return {
    reviews,
    meta: paginationInfo,
  }
}

// get single review
const getSingleReview = async (id: string) => {
  const result = await Review.findById(id)
  return result
}

// delete review
const deleteReview = async (id: string) => {
  const isExist = await Review.findById(id)
  if (!isExist) {
    throw new Error('Review not found')
  }
  const result = await Review.findByIdAndDelete(id)
  return result
}

export const ReviewService = {
  createReview,
  getAllReviews,
  getSingleReview,
  deleteReview,
}
