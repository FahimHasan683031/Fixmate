import express from "express";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import fileUploadHandler from "../../middleware/fileUploadHandler";
import validateRequest from "../../middleware/validateRequest";
import { ProviderControllers } from "./provider.controller";
import { ProviderValidation } from "./provider.validation";

const router = express.Router();

router
    .route("/")
    .get(auth(USER_ROLES.PROVIDER), ProviderControllers.profile)
    .patch(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        (req, res, next) => {
            if (req.body.data) {
                req.body = JSON.parse(req.body.data);
            }
            next();
        },
        validateRequest(ProviderValidation.updateProviderProfileSchema),
        ProviderControllers.profileUpdate
    );

router.get("/verification", auth(USER_ROLES.PROVIDER), ProviderControllers.verificaitonStatusCheck);
router.post(
    "/verification",
    auth(USER_ROLES.PROVIDER),
    fileUploadHandler(),
    ProviderControllers.sendVerificaitonRequest
);

router
    .route("/service")
    .get(auth(USER_ROLES.PROVIDER), ProviderControllers.providerServices)
    .post(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ProviderValidation.createServiceSchema),
        ProviderControllers.addService
    );

router
    .route("/service/:id")
    .get(auth(USER_ROLES.PROVIDER), ProviderControllers.viewService)
    .patch(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ProviderValidation.updateServiceSchema),
        ProviderControllers.updateService
    )
    .delete(auth(USER_ROLES.PROVIDER), ProviderControllers.deleteService);

router.get("/book", auth(USER_ROLES.PROVIDER), ProviderControllers.getBookings);
router.post(
    "/book",
    auth(USER_ROLES.PROVIDER),
    validateRequest(ProviderValidation.bookingsActionZodSchema),
    ProviderControllers.actionBooking
);

router.get("/book/:id", auth(USER_ROLES.PROVIDER), ProviderControllers.seeBooking);
router.get("/categories", auth(USER_ROLES.PROVIDER), ProviderControllers.getCategories);
router.get("/customer/:id", auth(USER_ROLES.PROVIDER), ProviderControllers.getCustomer);
router.post("/book/cancel/:id", auth(USER_ROLES.PROVIDER), ProviderControllers.cancelBooking);

router.get("/wallet", auth(USER_ROLES.PROVIDER), ProviderControllers.wallet);
router.post(
    "/withdrawal",
    auth(USER_ROLES.PROVIDER),
    validateRequest(ProviderValidation.withdrawalSchema),
    ProviderControllers.withdrawal
);

router.get("/reviews", auth(USER_ROLES.PROVIDER), ProviderControllers.ratings);
router.get("/payment-history", auth(USER_ROLES.PROVIDER), ProviderControllers.getPaymentHistory);

export const ProviderRoutes = router;
