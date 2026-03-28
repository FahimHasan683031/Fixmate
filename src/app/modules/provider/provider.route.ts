import { Router } from 'express';
import { ProviderControllers } from './provider.controller';
import { ProviderValidation } from './provider.validation';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = Router();

router.get('/home', auth(USER_ROLES.PROVIDER), ProviderControllers.providerHome);

router.get(
  '/book/:id',
  auth(USER_ROLES.PROVIDER),
  validateRequest(ProviderValidation.viewServiceSchema),
  ProviderControllers.seeBooking,
);

router.get(
  '/customer/:id',
  auth(USER_ROLES.PROVIDER),
  validateRequest(ProviderValidation.viewServiceSchema),
  ProviderControllers.getCustomer,
);

export const ProviderRoutes = router;
