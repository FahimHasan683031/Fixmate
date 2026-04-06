import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { ServiceController } from './service.controller';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = express.Router();

router.post(
  '/add-service',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  ServiceController.addService,
);

router.patch(
  '/update-service/:id',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  ServiceController.updateService,
);

router.delete('/delete-service/:id', auth(USER_ROLES.PROVIDER), ServiceController.deleteService);

router.get('/home',
  auth(USER_ROLES.CLIENT),
 ServiceController.getHomeServices
);

router.get('/',
  auth(USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  ServiceController.getServices);

router.get('/:id', ServiceController.getServiceById);

export const ServiceRoutes = router;
