import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { ReviewController } from './review.controller';

import validateRequest from '../../middleware/validateRequest';
import { ReviewValidation } from './review.validation';

const router = express.Router();

router.post(
  '/create',
  auth(USER_ROLES.CLIENT),
  validateRequest(ReviewValidation.createReviewSchema),
  ReviewController.createReview,
);

router.get('/provider/:providerId', ReviewController.getReviewsByProvider);

router.get('/service/:serviceId', ReviewController.getReviewsByService);

export const ReviewRoutes = router;
