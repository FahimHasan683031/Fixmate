import { Router } from 'express';
import { ClientControllers } from './client.controller';
import { ClientValidation } from './client.validation';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';

const router = Router();

router.get(
  '/provider/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
  validateRequest(ClientValidation.aProviderZodSchema),
  ClientControllers.getProviderById,
);

router.get(
  '/book/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
  validateRequest(ClientValidation.getPaginationZodSchema),
  ClientControllers.bookScreen,
);

router.get(
  '/book/view/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
  validateRequest(ClientValidation.getPaginationZodSchema),
  ClientControllers.seeBooking,
);


export const ClientRoutes = router;
