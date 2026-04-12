// Service Service
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Service } from './service.model';
import { IService } from './service.interface';
import QueryBuilder from '../../builder/QueryBuilder';
import unlinkFile from '../../../shared/unlinkFile';
import { USER_ROLE } from '../../../helpers/pdfMaker';
import { User } from '../user/user.model';

// Add a new service offered by a provider
const addService = async (user: JwtPayload, payload: Partial<IService>) => {
  const service = await Service.create({ ...payload, creator: user.id || user.authId });
  return service;
};

// Update an existing service's
const updateService = async (id: string, payload: Partial<IService>) => {
  const existingService = await Service.findById(id).lean().exec();
  if (!existingService) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service details you\'re looking for.');

  if (payload.image && existingService.image) {
    unlinkFile(existingService.image);
  }

  const service = await Service.findByIdAndUpdate(id, payload, { new: true }).lean().exec();
  return service;
};


// Retrieve all services created by a specific provider
const getHomeServices = async (user: JwtPayload, query: any) => {
  const { distance, minRating, maxRating, ...queryParams } = query;

  if (distance || minRating || maxRating) {
    const providerCriteria: any = { role: USER_ROLE.PROVIDER };

    if (minRating || maxRating) {
      providerCriteria['providerDetails.averageRating'] = {};
      if (minRating) providerCriteria['providerDetails.averageRating'].$gte = Number(minRating);
      if (maxRating) providerCriteria['providerDetails.averageRating'].$lte = Number(maxRating);
    }

    if (distance) {
      const client = await User.findById(user.id || user.authId);
      if (client && client.location && client.location.coordinates) {
        providerCriteria.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: client.location.coordinates,
            },
            $maxDistance: Number(distance) * 1000,
          },
        };
      }
    }

    const providers = await User.find(providerCriteria).select('_id');
    const providerIds = providers.map(p => p._id);
    queryParams.creator = { $in: providerIds };
  }

  const serviceQuery = new QueryBuilder(
    Service.find({ isDeleted: false, isSuspended: false }).populate(
      'creator',
      'name providerDetails.businessName location',
    ),
    queryParams,
  )
    .filter()
    .search(['category', 'subCategory'])
    .sort()
    .paginate()
    .fields();

  const data = await serviceQuery.modelQuery.lean().exec();
  const meta = await serviceQuery.getPaginationInfo();
  return { meta, data };
};


// Retrieve all available services
const getServices = async (user: JwtPayload, query: any) => {
  if(user.role === USER_ROLE.PROVIDER){
    query.creator = user.authId;
  }
  const serviceQuery = new QueryBuilder(
    Service.find({ isDeleted: false }).populate(
      'creator',
      'name image customId',
    ),
    query,
  )
    .filter()
    .search(['category', 'subCategory',"customId"])
    .sort()
    .paginate()
    .fields();

  const data = await serviceQuery.modelQuery.lean().exec();
  const meta = await serviceQuery.getPaginationInfo();
  return { meta, data };
};

// Get detailed information about a specific service by its ID
const getServiceById = async (id: string) => {
  const service = await Service.findById(id)
    .populate('creator', 'name image email contact location customId address')
    .lean()
    .exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service details in our system.');
  return service;
};

// Soft-delete a service by setting isDeleted to true
const deleteService = async (id: string) => {
  const service = await Service.findByIdAndUpdate(id, { isDeleted: true }, { new: true })
    .lean()
    .exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service you want to delete.');
  return service;
};

const toggleServiceSuspension = async (id: string, isSuspended: boolean) => {
  const service = await Service.findByIdAndUpdate(id, { isSuspended }, { new: true }).lean().exec();
  if (!service) throw new ApiError(StatusCodes.NOT_FOUND, 'We couldn\'t find the service you want to update.');
  return service;
};

export const ServiceService = {
  addService,
  updateService,
  deleteService,
  getHomeServices,
  getServices,
  getServiceById,
  toggleServiceSuspension,
};
