import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { VerificationController } from './verification.controller';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = express.Router();

router.post(
  '/send-request',
  auth(USER_ROLES.PROVIDER),
  fileAndBodyProcessorUsingDiskStorage(),
  VerificationController.sendRequest,
);

router.get('/status', auth(USER_ROLES.PROVIDER), VerificationController.getStatus);

router.get('/all-requests', auth(USER_ROLES.ADMIN), VerificationController.getAllRequests);

router.patch('/update-status/:id', auth(USER_ROLES.ADMIN), VerificationController.updateStatus);

export const VerificationRoutes = router;
