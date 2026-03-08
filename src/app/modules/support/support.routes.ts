import { Router } from "express";
import { SupportController } from "./support.controller";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import { SupportValidation } from "./support.validation";
import fileUploadHandler from "../../middleware/fileUploadHandler";

const router = Router();

router.route("/")
    .get(
        auth(USER_ROLES.ADMIN),
        validateRequest(SupportValidation.getSupportSchema),
        SupportController.getSupports
    )
    .post(
        auth(USER_ROLES.CLIENT, USER_ROLES.ADMIN, USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(SupportValidation.supportSchema),
        SupportController.createSupport
    );

router.route("/:id")
    .patch(
        auth(USER_ROLES.ADMIN),
        SupportController.markAsResolve
    );

export const SupportRoutes = router;
