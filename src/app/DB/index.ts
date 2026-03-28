import colors from 'colors';
import config from '../../config';
import { USER_ROLES, USER_STATUS } from '../../enum/user';
import { logger } from '../../shared/logger';
import { User } from '../modules/user/user.model';

const superAdmin = {
  name: 'Administrator',
  email: config.super_admin.email,
  password: config.super_admin.password,
  role: USER_ROLES.ADMIN,
  status: USER_STATUS.ACTIVE,
  verified: true,
};

const seedAdmin = async () => {
  const isExistAdmin = await User.findOne({
    email: superAdmin.email,
    role: USER_ROLES.ADMIN,
  });

  if (!isExistAdmin) {
    await User.create(superAdmin);
    logger.info(colors.green('✅ Admin account created successfully!'));
  } else {
    logger.info(colors.yellow('✅ Admin account already exists!'));
  }
};

export default seedAdmin;
