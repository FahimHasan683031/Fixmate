// Admin Service
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { USER_ROLES, USER_STATUS } from '../../../enum/user';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { Payment } from '../payment/payment.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { BOOKING_STATUS } from '../../../enum/booking';

import { Review } from '../review/review.model';
import { Verification } from '../verification/verification.model';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { Penalty } from '../penalty/penalty.model';

// Get platform overview statistics (users, providers, bookings, revenue)
export const overview = async (yearChart: string) => {
  const totalProviders = await User.countDocuments({ role: USER_ROLES.PROVIDER });
  const totalUsers = await User.countDocuments({ role: { $ne: USER_ROLES.ADMIN } });
  const upCommingOrders = await Booking.countDocuments({ bookingStatus: BOOKING_STATUS.ACCEPTED });

  const topProviders = await Review.aggregate([
    {
      $group: {
        _id: '$provider',
        reviewCount: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        lastReviewAt: { $max: '$createdAt' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.role': USER_ROLES.PROVIDER,
      },
    },
    { $sort: { reviewCount: -1, avgRating: -1, lastReviewAt: -1 } },
    { $limit: 3 },
    {
      $project: {
        _id: 0,
        userId: '$user._id',
        name: '$user.name',
        image: '$user.image',
        category: '$user.providerDetails.category',
        reviewCount: 1,
        avgRating: { $round: ['$avgRating', 2] },
        lastReviewAt: 1,
      },
    },
  ]);

  const recentServices = await Booking.find({
    bookingStatus: { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.SETTLED] },
  })
    .select('provider bookingStatus customer date service')
    .populate('provider', 'name contact address providerDetails.category')
    .populate('customer', 'name')
    .populate('service', 'price')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const payments = await Payment.find({
    booking: { $in: recentServices.map((b) => b._id) },
  }).select('booking paymentStatus');

  const enhancedRecentServices = recentServices.map((service) => {
    const payment = payments.find((p) => p.booking && p.booking.toString() === service._id.toString());
    return {
      ...service,
      paymentId: payment ? payment._id : null,
      paymentStatus: payment ? payment.paymentStatus : null,
    };
  });

  const [{ totalPlatformFee = 0 } = {}] = await Payment.aggregate([
    { $match: { paymentStatus: { $in: [PAYMENT_STATUS.CLIENT_PAID, PAYMENT_STATUS.SETTLED, PAYMENT_STATUS.PARTIAL_REFUNDED] } } },
    { $group: { _id: null, totalPlatformFee: { $sum: '$platformFee' } } },
  ]);

  const [{ totalClientPenalty = 0 } = {}] = await Payment.aggregate([
    { $group: { _id: null, totalClientPenalty: { $sum: '$clientPenalty' } } },
  ]);

  const [{ totalProviderPenalty = 0 } = {}] = await Penalty.aggregate([
    { $group: { _id: null, totalProviderPenalty: { $sum: '$taken' } } },
  ]);

  const totalRevenue = totalPlatformFee + totalClientPenalty + totalProviderPenalty;

  const year = Number(yearChart) || new Date().getFullYear();

  const monthlyPlatformFees = await Payment.aggregate([
    {
      $match: {
        paymentStatus: { $in: [PAYMENT_STATUS.CLIENT_PAID, PAYMENT_STATUS.SETTLED, PAYMENT_STATUS.PARTIAL_REFUNDED] },
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    { $group: { _id: { $month: '$createdAt' }, totalProfit: { $sum: '$platformFee' } } },
  ]);

  const monthlyClientPenalties = await Payment.aggregate([
    {
      $match: {
        clientPenalty: { $gt: 0 },
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    { $group: { _id: { $month: '$createdAt' }, totalProfit: { $sum: '$clientPenalty' } } },
  ]);

  const monthlyProviderPenalties = await Penalty.aggregate([
    {
      $match: {
        taken: { $gt: 0 },
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    { $group: { _id: { $month: '$createdAt' }, totalProfit: { $sum: '$taken' } } },
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyEarning = monthNames.map((name, index) => {
    const monthIndex = index + 1;
    const pf = monthlyPlatformFees.find((m) => m._id === monthIndex)?.totalProfit || 0;
    const cp = monthlyClientPenalties.find((m) => m._id === monthIndex)?.totalProfit || 0;
    const pp = monthlyProviderPenalties.find((m) => m._id === monthIndex)?.totalProfit || 0;
    return {
      month: name,
      profit: pf + cp + pp,
    };
  });


  return {
    totalUsers,
    totalProviders,
    upCommingOrders,
    totalRevenue,
    recentServices: enhancedRecentServices,
    topProviders,
    monthlyEarning,
  };
};

// Retrieve a paginated list of non-admin users
export const getUsers = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ role: { $ne: USER_ROLES.ADMIN }, status: { $ne: USER_STATUS.DELETED } }), query)
    .search(['name', 'email', 'address'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery.lean().exec();
  const meta = await userQuery.getPaginationInfo();
  return { meta, data: result };
};

// Get details of a single user by ID
export const getUser = async (id: string) => {
  const result: any = await User.findById(id).lean().exec();
  if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  if (result.role === USER_ROLES.CLIENT) {
    return {
      role: result.role,
      name: result.name,
      image: result.image,
      category: result.category,
      gender: result.gender,
      dateOfBirth: result.dateOfBirth,
      nationality: result.nationality,
      email: result.email,
      whatsapp: result.whatsApp,
      contact: result.contact,
      address: result.address,
    };
  }

  if (result.role === USER_ROLES.PROVIDER) {
    const reviews = await Review.find({ provider: result._id })
      .select('-updatedAt -__v -provider -service')
      .populate({ path: 'creator', select: 'name image' })
      .lean()
      .exec();

    const averageRating =
      reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length : 0;

    const [completedWork, upCommingWork, cancelWork] = await Promise.all([
      Booking.countDocuments({
        provider: result._id,
        bookingStatus: { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED] },
      }),
      Booking.countDocuments({ provider: result._id, bookingStatus: BOOKING_STATUS.ACCEPTED }),
      Booking.countDocuments({ provider: result._id, bookingStatus: BOOKING_STATUS.CANCELLED }),
    ]);

    const verificationFile: any = await Verification.findOne({ user: result._id }).lean().exec();

    return {
      name: result.name,
      role: result.role,
      image: result.image,
      category: result.category,
      gender: result.gender,
      dateOfBirth: result.dateOfBirth,
      nationality: result.nationality,
      email: result.email,
      whatsapp: result.whatsApp,
      contact: result.contact,
      address: result.address,

      completedWork,
      upCommingWork,
      cancelWork,

      experience: result.providerDetails?.experience,
      totalDoneWork: completedWork,
      review: averageRating,

      expertise: result.providerDetails?.category,
      country: result.nationality,
      serviceArea: result.address,
      serviceDistance: result.providerDetails?.distance,
      availableTime: {
        startTime: result.providerDetails?.startTime ?? '',
        endTime: result.providerDetails?.endTime ?? '',
      },
      availableDay: result.providerDetails?.availableDay,
      overview: result.providerDetails?.overView,

      licenses: verificationFile ? [verificationFile.license, verificationFile.nid] : [],
    };
  }

  return result;
};

// Block, unblock, or soft-delete a user
export const blockAndUnblockUser = async (id: string, status: string) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

  if (status === 'block') user.status = USER_STATUS.BLOCKED;
  else if (status === 'unblock') user.status = USER_STATUS.ACTIVE;
  else if (status === 'delete') user.status = USER_STATUS.DELETED;

  await user.save();
  return user;
};

// Generic find function for users or verification requests
export const find = async (query: any) => {
  const { compo, ...rest } = query;
  let model: any = User;
  if (compo === 'verification') {
  }
  const qb = new QueryBuilder(model.find(), rest)
    .search(['name', 'email'])
    .filter()
    .sort()
    .paginate()
    .fields();
  const data = await qb.modelQuery.lean().exec();
  const meta = await qb.getPaginationInfo();
  return { meta, data };
};

// Fetch payment data for multiple bookings to generate invoices
export const generateMultiInvoices = async (body: { bookingIds: string[] }) => {
  const payments = await Payment.find({ booking: { $in: body.bookingIds } })
    .populate('customer provider service')
    .lean()
    .exec();
  return payments;
};

// Advanced Endpoint for direct mathematical breakdown mapping platform profit logic
export const getRevenueTracking = async () => {
  const [{ totalPlatformFee = 0 } = {}] = await Payment.aggregate([
    { $match: { paymentStatus: { $in: [PAYMENT_STATUS.CLIENT_PAID, PAYMENT_STATUS.SETTLED, PAYMENT_STATUS.PARTIAL_REFUNDED] } } },
    { $group: { _id: null, totalPlatformFee: { $sum: '$platformFee' } } },
  ]);

  const [{ totalClientPenalty = 0 } = {}] = await Payment.aggregate([
    { $group: { _id: null, totalClientPenalty: { $sum: '$clientPenalty' } } },
  ]);

  const [{ totalProviderPenalty = 0 } = {}] = await Penalty.aggregate([
    { $group: { _id: null, totalProviderPenalty: { $sum: '$taken' } } },
  ]);

  const totalRevenue = totalPlatformFee + totalClientPenalty + totalProviderPenalty;

  return {
    breakdown: {
      platformFees: totalPlatformFee,
      clientPenalties: totalClientPenalty,
      providerPenaltiesCollected: totalProviderPenalty
    },
    netPlatformRevenue: totalRevenue
  };
};

export const AdminServices = {
  overview,
  getUsers,
  getUser,
  blockAndUnblockUser,
  find,
  generateMultiInvoices,
  getRevenueTracking,
};
