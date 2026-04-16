import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { ServiceController } from './service.controller';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';
import validateRequest from '../../middleware/validateRequest';
import { ServiceValidation } from './service.validation';

const router = express.Router();

router.post(
  '/add-service',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(ServiceValidation.createServiceZodSchema),
  ServiceController.addService,
);

router.get('/home',
  auth(USER_ROLES.CLIENT),
 ServiceController.getHomeServices
);

router.get('/',
  auth(USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  ServiceController.getServices);

router.get('/:id',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
   ServiceController.getServiceById
  );

router.patch(
  '/update-service/:id',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(ServiceValidation.updateServiceZodSchema),
  ServiceController.updateService,
);

router.patch(
  '/suspend/:id',
  auth(USER_ROLES.ADMIN),
  validateRequest(ServiceValidation.toggleSuspensionZodSchema),
  ServiceController.toggleServiceSuspension
);

router.delete(
  '/delete-service/:id',
  auth(USER_ROLES.PROVIDER),
  ServiceController.deleteService
);

export const ServiceRoutes = router;
