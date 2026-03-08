import express from "express";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import fileUploadHandler from "../../middleware/fileUploadHandler";
import validateRequest from "../../middleware/validateRequest";
import { VerificationControllers } from "./verification.controller";
import { VerificationValidation } from "./verification.validation";

const router = express.Router();

router.get("/", auth(USER_ROLES.PROVIDER), VerificationControllers.getVerificationStatus);
router.post(
    "/",
    auth(USER_ROLES.PROVIDER),
    fileUploadHandler(),
    validateRequest(VerificationValidation.sendVerificationRequestSchema),
    VerificationControllers.sendVerificationRequest
);

router.get("/requests", auth(USER_ROLES.ADMIN), VerificationControllers.getAllVerificationRequests);
router.patch("/requests/:id/:status", auth(USER_ROLES.ADMIN), VerificationControllers.approveOrRejectRequest);

export const VerificationRoutes = router;
