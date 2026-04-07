// Favorites Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { FavoritesService } from './favorites.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';

// Controller to handle adding a provider to favorites
const addOrRemoveFavorite = catchAsync(async (req: Request | any, res: Response) => {
  const result = await FavoritesService.addOrRemoveFavorite(req.user, req.body.providerId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service added to favorites successfully',
    data: result,
  });
});

// Controller to handle removing a provider from favorites
const removeFavorite = catchAsync(async (req: Request | any, res: Response) => {
  const result = await FavoritesService.removeFavorite(req.user, req.body.providerId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Service removed from favorites successfully',
    data: result,
  });
});

// Controller to retrieve the list of favorites for the current user
const getFavorites = catchAsync(async (req: Request | any, res: Response) => {
  const result = await FavoritesService.getFavorites(req.user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Favorites retrieved successfully',
    data: result,
  });
});

export const FavoritesController = {
  addOrRemoveFavorite,
  removeFavorite,
  getFavorites,
};
