import { Router } from "express";
import { PaymentControllers } from "./payment.controller";
import { USER_ROLES } from "../../../enum/user";
import auth from "../../middleware/auth";

const router = Router();

router
    .route("/success")
    .get(
        PaymentControllers.success
    );

router
    .route("/account/:id")
    .get(
        PaymentControllers.successAccount
    );

router
    .route("/account/refresh/:id")
    .get(
        PaymentControllers.refreshAccount
    );

router
    .route("/cancel")
    .get(
        PaymentControllers.failure
    );

router
    .route("/connected-account")
    .get(
        auth(USER_ROLES.PROVIDER),
        PaymentControllers.createConnectedAccount
    );

router
    .route("/webhook")
    .post(
        PaymentControllers.webhook
    );
    
export const PaymentRoutes = router;
