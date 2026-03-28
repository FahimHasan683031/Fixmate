import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminValidation } from './admin.validation';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';

const router = Router();

router.get('/overview', auth(USER_ROLES.ADMIN), AdminController.overview);

router.get(
  '/users',
  auth(USER_ROLES.ADMIN),
  AdminController.getUsers,
);

router.get(
  '/users/:id',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.idParamsAdminSchema),
  AdminController.getUser,
);

router.delete(
  '/users/:id/:status',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.blockAndUnblockUserSchema),
  AdminController.blockAndUnblockUser,
);

router.get(
  '/find',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.findSchema),
  AdminController.find,
);

router.post(
  '/generate-multi-invoices',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.generateMultiInvoicesSchema),
  AdminController.generateMultiInvoices,
);

export const AdminRoutes = router;
