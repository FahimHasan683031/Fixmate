import express from "express";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import { TermsAndPolicyControllers } from "./terms&policy.controller";
import { TermsAndPolicyValidation } from "./terms&policy.validation";

const router = express.Router();

router.get("/terms", TermsAndPolicyControllers.getTerms);
router.get("/policy", TermsAndPolicyControllers.getPolicy);

router.patch(
    "/terms",
    auth(USER_ROLES.ADMIN),
    validateRequest(TermsAndPolicyValidation.termsAndPolicySchema),
    TermsAndPolicyControllers.upsertTerms
);

router.patch(
    "/policy",
    auth(USER_ROLES.ADMIN),
    validateRequest(TermsAndPolicyValidation.termsAndPolicySchema),
    TermsAndPolicyControllers.upsertPolicy
);

export const TermsAndPolicyRoutes = router;
