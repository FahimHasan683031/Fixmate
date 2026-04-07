import express from 'express';
import { USER_ROLES } from '../../../enum/user';
import auth from '../../middleware/auth';
import { FavoritesController } from './favorites.controller';

const router = express.Router();

router.post('/add', auth(USER_ROLES.CLIENT), FavoritesController.addOrRemoveFavorite);

router.post('/remove', auth(USER_ROLES.CLIENT), FavoritesController.removeFavorite);

router.get('/', auth(USER_ROLES.CLIENT), FavoritesController.getFavorites);

export const FavoritesRoutes = router;
