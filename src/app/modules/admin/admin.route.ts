import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";
import auth from "../../middleware/auth";
import { fileAndBodyProcessorUsingDiskStorage } from "../../middleware/processReqBody";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";

const router = Router();

router.get(
    "/overview",
    auth(USER_ROLES.ADMIN),
    AdminController.overview
);

router.get(
    "/users",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.usersAdminSchema),
    AdminController.getUsers
);

router.get(
    "/users/:id",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.idParamsAdminSchema),
    AdminController.getUser
);

router.delete(
    "/users/:id/:status",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.blockAndUnblockUserSchema),
    AdminController.blockAndUnblockUser
);

router
    .route("/categories")
    .get(
        auth(USER_ROLES.ADMIN),
        validateRequest(AdminValidation.getCategoriesSchema),
        AdminController.getCategories
    )
    .post(
        auth(USER_ROLES.ADMIN),
        fileAndBodyProcessorUsingDiskStorage(),
        validateRequest(AdminValidation.addNewCategorySchema),
        AdminController.addNewCategory
    )
    .patch(
        auth(USER_ROLES.ADMIN),
        fileAndBodyProcessorUsingDiskStorage(),
        validateRequest(AdminValidation.updateCategorySchema),
        AdminController.updateCategory
    );

router.delete(
    "/categories/:id",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.idParamsAdminSchema),
    AdminController.deleteCategory
);

router
    .route("/policy")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
        AdminController.getPolicy
    )
    .patch(
        auth(USER_ROLES.ADMIN),
        validateRequest(AdminValidation.updatePolicySchema),
        AdminController.updatePolicy
    );

router
    .route("/terms")
    .get(
        auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
        AdminController.getTerms
    )
    .patch(
        auth(USER_ROLES.ADMIN),
        validateRequest(AdminValidation.updateTermsSchema),
        AdminController.updateTerms
    );

router.get(
    "/requests",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.getRequestsSchema),
    AdminController.getRequests
);

router.post(
    "/requests/:id/:status",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.approveOrRejectSchema),
    AdminController.approveOrReject
);

router.get(
    "/find",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.findSchema),
    AdminController.find
);

router.get(
    "/bookings",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.getBookingsSchema),
    AdminController.getBookings
);

router.post(
    "/generate-multi-invoices",
    auth(USER_ROLES.ADMIN),
    validateRequest(AdminValidation.generateMultiInvoicesSchema),
    AdminController.generateMultiInvoices
);

export const AdminRoutes = router;
