import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { BookingValidation } from './booking.validation';
import validateRequest from '../../middleware/validateRequest';
import { BookingController } from './booking.controller';

const router = express.Router();

router.post(
  '/create', 
  auth(USER_ROLES.CLIENT), 
  validateRequest(BookingValidation.createBookingSchema),
  BookingController.createBooking
);

router.get(
  '/',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  BookingController.getBookings,
);

router.get(
  '/download',
  auth(USER_ROLES.ADMIN),
  BookingController.downloadBookings,
);

router.get(
  '/:id',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  BookingController.getBookingById,
);

router.patch(
  '/:id/status',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  validateRequest(BookingValidation.updateStatusSchema),
  BookingController.updateBookingStatus,
);

export const BookingRoutes = router;
