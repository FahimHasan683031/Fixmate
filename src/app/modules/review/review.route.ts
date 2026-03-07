import express from 'express'
import { ReviewController } from './review.controller'
import validateRequest from '../../middleware/validateRequest'
import { ReviewValidationSchema } from './review.validation'

const router = express.Router()

router.post(
  '/',
  validateRequest(ReviewValidationSchema),
  ReviewController.createReview,
)

router.get('/', ReviewController.getAllReviews)
router.get('/:id', ReviewController.getSingleReview)
router.delete('/:id', ReviewController.deleteReview)


export const ReviewRoutes = router
