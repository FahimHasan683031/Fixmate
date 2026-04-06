import { Router } from 'express';
import { DisputeController } from './dispute.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { DisputeValidation } from './dispute.validation';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = Router();

router.post(
  '/',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(DisputeValidation.createDisputeSchema),
  DisputeController.createDispute
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  DisputeController.getAllDisputes
);

router.get(
  '/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  DisputeController.getDisputeById
);

router.patch(
  '/:id/resolve',
  auth(USER_ROLES.ADMIN),
  validateRequest(DisputeValidation.resolveDisputeSchema),
  DisputeController.resolveDispute
);


export const DisputeRoutes = router;
