import { Router } from 'express';
import { SettingController } from './setting.controller';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';

const router = Router();

router.get('/', auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER), SettingController.getSetting);
router.patch('/', auth(USER_ROLES.ADMIN), SettingController.updateSetting);

export const SettingRoutes = router;
