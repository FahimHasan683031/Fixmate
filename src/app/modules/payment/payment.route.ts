import { Router } from 'express';
import { PaymentControllers } from './payment.controller';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';

const router = Router();

router.get('/success', PaymentControllers.success);

router.get('/account/:id', PaymentControllers.successAccount);

router.get('/account/refresh/:id', PaymentControllers.refreshAccount);

router.get('/cancel', PaymentControllers.failure);

router.get(
  '/connected-account',
  auth(USER_ROLES.PROVIDER),
  PaymentControllers.createConnectedAccount,
);

router.post('/webhook', PaymentControllers.webhook);

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
