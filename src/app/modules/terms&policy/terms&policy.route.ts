import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { TermsAndPolicyController } from './terms&policy.controller';

const router = express.Router();

router.get('/terms', TermsAndPolicyController.getTerms);

router.get('/policy', TermsAndPolicyController.getPolicy);

router.post('/upsert-terms', auth(USER_ROLES.ADMIN), TermsAndPolicyController.upsertTerms);

router.post('/upsert-policy', auth(USER_ROLES.ADMIN), TermsAndPolicyController.upsertPolicy);

export const TermsAndPolicyRoutes = router;
