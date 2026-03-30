import { Router } from 'express';
import { PaymentControllers } from './payment.controller';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';

const router = Router();

router.post(
  '/generate-recipient',
  auth(USER_ROLES.PROVIDER),
  PaymentControllers.generateRecipient,
);

router.get('/wallet', auth(USER_ROLES.PROVIDER), PaymentControllers.getWallet);

router.get(
  '/history',
  auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT),
  PaymentControllers.getPaymentHistory,
);

router.get(
  '/history/:id',
  auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT),
  PaymentControllers.getPaymentDetails,
);

router.post('/withdraw', auth(USER_ROLES.PROVIDER), PaymentControllers.withdraw);

export const PaymentRoutes = router;
