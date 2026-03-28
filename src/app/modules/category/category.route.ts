import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { CategoryController } from './category.controller';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = express.Router();

router.post('/create-category',
     auth(USER_ROLES.ADMIN),
     fileAndBodyProcessorUsingDiskStorage(),
      CategoryController.addNewCategory
    );

router.get('/', CategoryController.getCategories);

router.patch('/update-category',
     auth(USER_ROLES.ADMIN),
     fileAndBodyProcessorUsingDiskStorage(),
      CategoryController.updateCategory
    );

router.delete('/:id', auth(USER_ROLES.ADMIN), CategoryController.deleteCategory);

export const CategoryRoutes = router;
