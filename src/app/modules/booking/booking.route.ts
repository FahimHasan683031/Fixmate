import express from "express";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import { BookingControllers } from "./booking.controller";
import { BookingValidation } from "./booking.validation";

const router = express.Router();

router
    .route("/")
    .get(auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN), BookingControllers.getMyBookings)
    .post(
        auth(USER_ROLES.CLIENT),
        validateRequest(BookingValidation.createBookingSchema),
        BookingControllers.createBooking
    );

router
    .route("/:id")
    .get(auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER, USER_ROLES.ADMIN), BookingControllers.getSingleBooking)
    .patch(
        auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
        validateRequest(BookingValidation.updateBookingStatusSchema),
        BookingControllers.updateBookingStatus
    );

export const BookingRoutes = router;
