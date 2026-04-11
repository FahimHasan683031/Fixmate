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
  '/update-user-profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(UserValidation.updateUserProfileZodSchema),
  UserController.updateUserProfile,
);

router.patch(
  '/update-provider-profile',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(UserValidation.updateProviderProfileZodSchema),
  UserController.updateProviderProfile,
);

router.delete(
  '/delete-profile',
  auth( USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  UserController.deleteProfile,
);

router.get(
  '/download',
  auth(USER_ROLES.ADMIN),
  UserController.downloadUsers,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  UserController.getUsers,
);

router.get(
  '/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  validateRequest(UserValidation.idParamsSchema),
  UserController.getUser,
);

router.delete(
  '/:id/:status',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.blockAndUnblockUserSchema),
  UserController.blockAndUnblockUser,
);

export const UserRoutes = router;
