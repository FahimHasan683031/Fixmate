import { Router } from "express";
import { ClientControllers } from "./client.controller";
import { ClientValidation } from "./client.validation";
import auth from "../../middleware/auth";
import { fileAndBodyProcessorUsingDiskStorage } from "../../middleware/processReqBody";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import { generateInvoiceAPI } from "../../../helpers/pdfMaker";
import fileUploadHandler from "../../middleware/fileUploadHandler";

const router = Router();

router
    .route("/")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        ClientControllers.getUserProfile
    )
    .patch(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        fileUploadHandler(),
        validateRequest(ClientValidation.updateUserZodSchema),
        ClientControllers.updateProfile
    )
    .delete(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
        ClientControllers.deleteProfile
    );

router
    .route("/services")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getPaginationZodSchema),
        ClientControllers.getServices
    );

router
    .route("/provider/:id")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.aProviderZodSchema),
        ClientControllers.getProviderById
    );

router
    .route("/favorites")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getPaginationZodSchema),
        ClientControllers.getFavorites
    );

router
    .route("/favorites/:id")
    .post(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.AddFavoriteZodSchema),
        ClientControllers.addFavorite
    )
    .delete(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.RemoveFavoriteZodSchema),
        ClientControllers.removeFavorite
    );

router
    .route("/book")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getPaginationZodSchema),
        ClientControllers.getBookings
    )
    .post(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.createBookingZodSchema),
        ClientControllers.createBooking
    );

router
    .route("/book/:id")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getPaginationZodSchema),
        ClientControllers.bookScreen
    )
    .patch(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.updateBookingZodSchema),
        ClientControllers.updateBooking
    )
    .delete(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.removeBookingZodSchema),
        ClientControllers.cancelBooking
    );

router
    .route("/book/view/:id")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getPaginationZodSchema),
        ClientControllers.seeBooking
    );

router
    .route("/book/accept/:id")
    .post(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.acceptBookingZodSchema),
        ClientControllers.acceptBooking
    );

router
    .route("/categories")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        validateRequest(ClientValidation.getCategoriesZodSchema),
        ClientControllers.getCategories
    );

router
    .route("/review/:id")
    .post(
        auth(USER_ROLES.CLIENT, USER_ROLES.ADMIN),
        validateRequest(ClientValidation.giveReviewSchema),
        ClientControllers.giveReview
    );

router
    .route("/payment-history")
    .get(
        auth(USER_ROLES.CLIENT, USER_ROLES.ADMIN),
        validateRequest(ClientValidation.getCategoriesZodSchema),
        ClientControllers.getPaymentHistory
    );

router
    .route("/payment/:id")
    .get(
        ClientControllers.getPaymentInfo
    );

router
    .route("/download-pdf/:id")
    .get(
        generateInvoiceAPI
    );

export const ClientRoutes = router;
