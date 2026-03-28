import { Router } from 'express';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = Router();

router.get(
  '/profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  UserController.getProfile,
);

router.patch(
  '/update-profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(UserValidation.updateProfileZodSchema),
  UserController.updateProfile,
);

router.delete(
  '/delete-profile',
  auth( USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  UserController.deleteProfile,
);

export const UserRoutes = router;
