import { NextFunction, Request, Response, Router } from "express";
import { ProviderControllers } from "./provider.controller";
import { ProviderValidation } from "./provider.validation";
import validateRequest from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enum/user";
import fileUploadHandler from "../../middlewares/fileUploadHandler";

const router = Router();

router.route("/")
    .get(
        auth(USER_ROLES.PROVIDER),
        ProviderControllers.provider
    )
    .patch(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        (req: Request, res: Response, next: NextFunction) => {
            if (req.body?.data) {
                req.body = ProviderValidation.updateProviderProfileSchema.parse(JSON.parse(req.body.data));
            }
            return ProviderControllers.providerProfileUpdate(req, res, next);
        }
    )
    .delete(
        auth(USER_ROLES.PROVIDER),
        ProviderControllers.providerProfileDelete
    );

router.route("/home")
    .get(
        auth(USER_ROLES.PROVIDER),
        ProviderControllers.providerHome
    );

router.route("/verification")
    .get(
        auth(USER_ROLES.PROVIDER),
        ProviderControllers.providerVerification
    )
    .post(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        ProviderControllers.sendVerification
    );

router.route("/service")
    .get(
        auth(USER_ROLES.PROVIDER),
        ProviderControllers.providerServices
    )
    .post(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ProviderValidation.createServiceSchema),
        ProviderControllers.addService
    );

router.route("/service/:id")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.viewServiceSchema),
        ProviderControllers.viewService
    )
    .patch(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ProviderValidation.updateServiceSchema),
        ProviderControllers.updateService
    )
    .delete(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.deleteServiceSchema),
        ProviderControllers.deleteService
    );

router.route("/book")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.getPaginationZodSchema),
        ProviderControllers.getBookings
    )
    .post(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.bookingsActionZodSchema),
        ProviderControllers.actionBooking
    );

router.route("/book/:id")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.viewServiceSchema),
        ProviderControllers.seeBooking
    );

router.route("/categories")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.getCategoriesSchema),
        ProviderControllers.getCategories
    );

router.route("/customer/:id")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.viewServiceSchema),
        ProviderControllers.getCustomer
    );

router.route("/book/cancel/:id")
    .post(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.viewServiceSchema),
        ProviderControllers.cancelBooking
    );

router.route("/payment-history")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.getPaginationZodSchema),
        ProviderControllers.getPaymentHistory
    );

router.route("/wallet")
    .post(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.whitdrawalSchema),
        ProviderControllers.whitdrawal
    )
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.getPaginationZodSchema),
        ProviderControllers.wallet
    );

router.route("/reviews")
    .get(
        auth(USER_ROLES.PROVIDER),
        validateRequest(ProviderValidation.getPaginationZodSchema),
        ProviderControllers.ratings
    );

export const ProviderRoutes = router;
