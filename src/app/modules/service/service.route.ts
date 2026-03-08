import express from "express";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import fileUploadHandler from "../../middleware/fileUploadHandler";
import validateRequest from "../../middleware/validateRequest";
import { ServiceControllers } from "./service.controller";
import { ServiceValidation } from "./service.validation";

const router = express.Router();

router
    .route("/")
    .get(ServiceControllers.getAllServices)
    .post(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ServiceValidation.createServiceSchema),
        ServiceControllers.createService
    );

router
    .route("/:id")
    .get(ServiceControllers.getSingleService)
    .patch(
        auth(USER_ROLES.PROVIDER),
        fileUploadHandler(),
        validateRequest(ServiceValidation.updateServiceSchema),
        ServiceControllers.updateService
    )
    .delete(auth(USER_ROLES.PROVIDER), ServiceControllers.deleteService);

export const ServiceRoutes = router;
