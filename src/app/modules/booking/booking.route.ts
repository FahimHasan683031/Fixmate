import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { BookingController } from './booking.controller';

const router = express.Router();

router.post('/create', auth(USER_ROLES.CLIENT), BookingController.createBooking);

router.get(
  '/',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  BookingController.getBookings,
);

router.get(
  '/:id',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN),
  BookingController.getBookingById,
);

router.post(
  '/cancel/:id',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  BookingController.cancelBooking,
);

router.post(
  '/dispute/:id',
  auth(USER_ROLES.CLIENT),
  BookingController.disputeBooking,
);

export const BookingRoutes = router;
