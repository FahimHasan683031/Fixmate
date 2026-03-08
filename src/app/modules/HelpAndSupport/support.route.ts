import { Router } from "express";
import { SupportControllers } from "./support.controller";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import fileUploadHandler from "../../middleware/fileUploadHandler";
import { supportValidation } from "./support.validation";

const router = Router();

router
    .route("/")
    .get(
        auth(USER_ROLES.ADMIN),
        validateRequest(supportValidation.getSupportSchema),
        SupportControllers.getSupports
    )
    .post(
        auth(USER_ROLES.CLIENT, USER_ROLES.ADMIN, USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(supportValidation.supportSchema),
        SupportControllers.createSupport
    );

router
    .route("/:id")
    .patch(
        auth(USER_ROLES.ADMIN),
        SupportControllers.markAsResolve
    );

export const SupportRoutes = router;
