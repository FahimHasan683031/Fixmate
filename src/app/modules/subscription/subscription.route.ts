import { Router } from 'express';
import { SubscriptionController } from './subscription.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = Router();

router.post(
  '/verify-receipt',
  auth(USER_ROLES.PROVIDER),
  SubscriptionController.verifyReceipt
);

router.post(
  '/webhook/apple',
  SubscriptionController.handleAppleWebhook
);

router.post(
  '/webhook/google',
  SubscriptionController.handleGoogleWebhook
);

export const SubscriptionRoutes = router;
