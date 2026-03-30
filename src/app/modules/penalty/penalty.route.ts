import { Router } from 'express';
import { PenaltyController } from './penalty.controller';
import validateRequest from '../../middleware/validateRequest';
import { PenaltyValidation } from './penalty.validation';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = Router();

router.post(
  '/create',
  auth(USER_ROLES.ADMIN),
  validateRequest(PenaltyValidation.createPenaltySchema),
  PenaltyController.createPenaltyByAdmin
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  PenaltyController.getAllPenalties
);

router.get(
  '/my',
  auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT),
  PenaltyController.getMyPenalties
);

export const PenaltyRoutes = router;
