import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminValidation } from './admin.validation';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';

const router = Router();

router.get('/overview', auth(USER_ROLES.ADMIN), AdminController.overview);


router.get(
  '/find',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.findSchema),
  AdminController.find,
);


router.get(
  '/revenue-tracking',
  auth(USER_ROLES.ADMIN),
  AdminController.getRevenueTracking,
);

export const AdminRoutes = router;
