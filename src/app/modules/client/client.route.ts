import { Router } from "express";
import { ClientController } from "./client.controller";
import { ClientValidation } from "./client.validation";
import auth from "../../middleware/auth";
import { fileAndBodyProcessorUsingDiskStorage } from "../../middleware/processReqBody";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";

const router = Router();

router
    .route("/")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        ClientController.getUserProfile
    )
    .patch(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT),
        fileAndBodyProcessorUsingDiskStorage(),
        validateRequest(ClientValidation.updateUserZodSchema),
        ClientController.updateProfile
    )
    .delete(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
        ClientController.deleteProfile
    );

export const ClientRoutes = router;
