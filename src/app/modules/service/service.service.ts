// Service Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Service } from './service.model';
import { IService } from './service.interface';
import QueryBuilder from '../../builder/QueryBuilder';
import unlinkFile from '../../../shared/unlinkFile';

// Add a new service offered by a provider
const addService = async (user: JwtPayload, payload: Partial<IService>) => {
  const service = await Service.create({ ...payload, creator: user.id || user.authId });
  return service;
};

// Update an existing service's details and handle image replacement
const updateService = async (id: string, payload: Partial<IService>) => {
  const existingService = await Service.findById(id).lean().exec();
  if (!existingService) throw new ApiError(StatusCodes.NOT_FOUND, 'Service not found!');

  if (payload.image && existingService.image) {
    unlinkFile(existingService.image);
  }

  const service = await Service.findByIdAndUpdate(id, payload, { new: true }).lean().exec();
  return service;
};

// Soft-delete a service by setting isDeleted to true
const deleteService = async (id: string) => {
  const service = await Service.findByIdAndUpdate(id, { isDeleted: true }, { new: true })
    .lean()
    .exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'Service not found!');
  return service;
};

// Retrieve all services created by a specific provider
const getProviderServices = async (user: JwtPayload, query: any) => {
  const serviceQuery = new QueryBuilder(
    Service.find({ creator: user.id || user.authId, isDeleted: false }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await serviceQuery.modelQuery.lean().exec();
  const meta = await serviceQuery.getPaginationInfo();
  return { meta, data };
};

import { Review } from '../review/review.model';
import { User } from '../user/user.model';
import { CustomerFavorite } from '../favorites/customer.favorite.model';
import { calculateDistanceInKm } from '../../../helpers/calculateDistance';

// Retrieve all available services across the platform with pagination and filtering
const getServices = async (user: JwtPayload | null, query: any) => {
  const serviceQuery = new QueryBuilder(
    Service.find({ isDeleted: false }).populate(
      'creator',
      'name image email contact location providerDetails.category providerDetails.experience',
    ),
    query,
  )
    .search(['category', 'subCategory'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const services = await serviceQuery.modelQuery.lean().exec();
  const meta = await serviceQuery.getPaginationInfo();

  // Get user's favorites if authenticated
  const favoriteProviderIds = user
    ? (
        await CustomerFavorite.find({
          customer: user.id || user.authId,
        })
          .select('provider')
          .lean()
      ).map((fav) => fav.provider.toString())
    : [];

  // Enhance services with provider stats and favorite status
  const enhancedServices = await Promise.all(
    services.map(async (service: any) => {
      const providerId = service.creator?._id;
      if (!providerId) return service;

      const [reviewCount, averageRatingResult] = await Promise.all([
        Review.countDocuments({ provider: providerId }),
        Review.aggregate([
          { $match: { provider: providerId } },
          { $group: { _id: null, averageRating: { $avg: '$rating' } } },
        ]),
      ]);

      const averageRating =
        averageRatingResult.length > 0 ? Math.round(averageRatingResult[0].averageRating * 10) / 10 : 0;

      const isFavorite = favoriteProviderIds.includes(providerId.toString());

      return {
        service: {
          _id: service._id,
          image: service.image,
          category: service.category,
          price: service.price,
          subCategory: service.subCategory,
          expertise: service.expertise,
        },
        provider: {
          _id: providerId,
          name: service.creator?.name,
          image: service.creator?.image,
          reviewCount,
          averageRating,
          isFavorite,
          coordinates: service.creator?.location?.coordinates || [0, 0],
        },
      };
    }),
  );

  // Apply distance and rating filters manually if provided (legacy behavior)
  let filteredData = enhancedServices;
  const { distance, rating } = query;

  if (distance || rating) {
    const currentUser = user ? await User.findById(user.id || user.authId).select('location').lean() : null;
    const userCoords = currentUser?.location?.coordinates;

    filteredData = enhancedServices.filter((item: any) => {
      let passRating = true;
      let passDistance = true;

      if (rating) passRating = item.provider.averageRating >= Number(rating);
      if (distance && userCoords) {
        const dist = calculateDistanceInKm(
          userCoords[1],
          userCoords[0],
          item.provider.coordinates[1],
          item.provider.coordinates[0],
        );
        passDistance = dist <= Number(distance);
        item.distance = Math.round(dist);
      }

      return passRating && passDistance;
    });
  }

  return { meta, data: filteredData };
};

// Get detailed information about a specific service by its ID
const getServiceById = async (id: string) => {
  const service = await Service.findById(id)
    .populate('creator', 'name image email contact location')
    .lean()
    .exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'Service not found!');
  return service;
};

export const ServiceService = {
  addService,
  updateService,
  deleteService,
  getProviderServices,
  getServices,
  getServiceById,
};
