import { Router } from 'express';
import { ClientControllers } from './client.controller';
import { ClientValidation } from './client.validation';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { generateInvoiceAPI } from '../../../helpers/pdfMaker';

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

router.post(
  '/book/accept/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
  validateRequest(ClientValidation.acceptBookingZodSchema),
  ClientControllers.acceptBooking,
);

router.get('/download-pdf/:id', generateInvoiceAPI);

export const ClientRoutes = router;
