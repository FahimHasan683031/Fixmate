// Favorites Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { CustomerFavorite } from './customer.favorite.model';
import { User } from '../user/user.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { Types } from 'mongoose';

// Toggle favorite status for a provider: adds if not present, removes if it is
const addOrRemoveFavorite = async (user: JwtPayload, providerId: string) => {
  const userId = user.authId;
  const existingFavorite = await CustomerFavorite.findOne({
    customer: new Types.ObjectId(userId),
    provider: providerId,
  })
    .lean()
    .exec();

  if (existingFavorite) {
    await CustomerFavorite.findByIdAndDelete(existingFavorite._id).lean().exec();
    return { message: 'Favorite removed successfully' };
  }

  console.log(providerId)

  const providerDef = await User.findById(providerId).lean().exec();
  if (!providerDef) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service provider you\'re looking for.');

  const favorite = await CustomerFavorite.create({
    customer: new Types.ObjectId(userId),
    provider: providerDef._id,
  });
  return favorite;
};

// Explicitly remove a provider from the user's favorite list
const removeFavorite = async (user: JwtPayload, providerId: string) => {
  const favorite = await CustomerFavorite.findOneAndDelete({
    customer: new Types.ObjectId(user.authId),
    provider: providerId,
  })
    .lean()
    .exec();
  if (!favorite) throw new ApiError(StatusCodes.NOT_FOUND, 'This provider is not in your favorites list.');
  return favorite.provider;
};

// Fetch all favorite providers for the current user with pagination
const getFavorites = async (user: JwtPayload, query: any) => {
  const userId = user.authId;
  const favoriteQuery = new QueryBuilder(
    CustomerFavorite.find({ customer: new Types.ObjectId(userId) })
      .populate('provider', 'name image overView')
      .select('provider'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await favoriteQuery.modelQuery.lean().exec();
  const meta = await favoriteQuery.getPaginationInfo();
  return { meta, data };
};

export const FavoritesService = {
  addOrRemoveFavorite,
  removeFavorite,
  getFavorites,
};
