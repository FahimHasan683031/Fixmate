import { JwtPayload } from 'jsonwebtoken';
import { createPaystackCheckout, refundPaystackTransaction } from '../../../helpers/paystackHelper';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import unlinkFile from '../../../shared/unlinkFile';
import { IUser } from '../user/user.interface';
import { USER_STATUS } from '../../../enum/user';
import { Types, PopulateOptions, FilterQuery } from 'mongoose';
import { IBooking } from '../booking/booking.interface';
import { BOOKING_STATUS } from '../../../enum/booking';
import { PAYMENT_STATUS } from '../../../enum/payment';
import { calculateDistanceInKm } from '../../../helpers/calculateDistance';
import bcrypt from "bcrypt";
import { Request } from 'express';
import { Service } from '../service/service.model';
import { CustomerFavorite } from '../favorites/customer.favorite.model';
import { Review } from '../review/review.model';
import { User } from '../user/user.model';
import { NotificationService } from '../notification/notification.service';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { Booking } from '../booking/booking.model';
import { Category } from '../category/category.model';
import { Payment } from '../payment/payment.model';
import { IReview } from '../review/review.interface';
import QueryBuilder from '../../builder/QueryBuilder';
import { BookingStateMachine } from '../booking/bookingStateMachine';

export const getUserProfile = async (user: JwtPayload) => {
    const existingUser = await User.findById(user.id || user.authId).select("name image gender email address dateOfBirth nationality whatsApp contact role").lean().exec();
    if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");
    return existingUser;
};

export const updateProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
    const existingUser = await User.findById(user.id || user.authId).lean().exec();
    if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");

    if (payload.image && existingUser.image) unlinkFile(existingUser.image!);

    const updatable = await User.findByIdAndUpdate(user.id || user.authId, payload, { new: true }).lean().exec();

    return updatable;
};

export const deleteProfile = async (user: JwtPayload, password: string) => {
    const existingUser = await User.findById(user.id || user.authId).select("+password").lean().exec();
    if (!existingUser) throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");

    const isMatch = password && await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Password not match!");
    }

    await User.findByIdAndUpdate(existingUser._id, { status: USER_STATUS.DELETED }).lean().exec();
};

export const getServices = async (user: JwtPayload, query: any) => {
    const { category, subCategory, price, distance, search, rating, ...rest } = query;

    try {
        let filter: any = { isDeleted: { $ne: true } };

        if (category) filter.category = category;
        if (subCategory) filter.subCategory = subCategory;
        if (price) filter.price = { $lte: Number(price) };
        if (rating) filter.rating = { $gte: Number(rating) };

        const serviceQuery = new QueryBuilder(
            Service.find(filter).populate('creator', '_id name image contact address location category experience'),
            { ...rest, searchTerm: search }
        )
            .search(['category', 'subCategory'])
            .filter()
            .sort()
            .paginate()
            .fields();

        const services = await serviceQuery.modelQuery.lean().exec();
        const meta = await serviceQuery.getPaginationInfo();

        const favoriteProviders = await CustomerFavorite.find({ customer: new Types.ObjectId(user.id || user.authId) }).select('provider').lean();
        const favoriteProviderIds = favoriteProviders.map(fav => fav.provider.toString());

        const servicesWithStats = await Promise.all(
            services.map(async (service: any) => {
                const reviewCount = await Review.countDocuments({ provider: service.creator?._id });

                const averageRating = await Review.aggregate([
                    { $match: { provider: service.creator?._id } },
                    { $group: { _id: null, averageRating: { $avg: "$rating" } } }
                ]);

                const coordinates = await User.findById(service.creator._id).lean().exec();
                const isFavorite = favoriteProviderIds.includes(service.creator?._id.toString());

                return {
                    ...service,
                    providerStats: {
                        coordinates: coordinates,
                        reviewCount,
                        averageRating: averageRating.length > 0 ? Math.round(averageRating[0].averageRating * 10) / 10 : 0,
                        isFavorite
                    }
                };
            })
        );

        const formetedData = servicesWithStats.map(service => {
            return {
                service: {
                    _id: service._id,
                    image: service.image,
                    category: service.category,
                    price: service.price,
                    subCategory: service.subCategory
                },
                provider: {
                    image: service.creator?.image,
                    name: service.creator?.name,
                    _id: service.creator._id,
                    reviewCount: service.providerStats.reviewCount,
                    coordinates: service?.providerStats?.coordinates?.location?.coordinates,
                    averageRating: service.providerStats.averageRating,
                    isFavorite: service.providerStats.isFavorite
                }
            };
        });

        if (distance && rating) {
            const currentUser = await User.findById(user.id || user.authId).select("location").lean().exec().then(e => e?.location?.coordinates).catch(e => console.error(e)) as any;
            const allCountedDistance = formetedData.map(e => ({
                ...e,
                distance: Math.round(calculateDistanceInKm(currentUser[1]!, currentUser[0]!, e.provider.coordinates[1], e.provider.coordinates[0]))
            }));
            const filteredData = allCountedDistance.filter(e => e.provider.averageRating >= rating).filter(e => e.distance <= distance);
            return { meta, data: filteredData };
        }

        return { meta, data: formetedData };

    } catch (error: any) {
        console.log(error);
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to fetch services: ${error.message}`);
    }
};

export const getProviderById = async (user: JwtPayload, id: Types.ObjectId, query: any) => {
    const provider = await User.findById(id).lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const { limit, page, sortBy, sortOrder } = paginationHelper.calculatePagination({ limit: query.servicesLimit, page: query.servicesPage, sortOrder: query.servicesSortOrder });

    const services = await Service.find({ creator: id, isDeleted: false })
        .select("creator category image price expertise")
        .populate({ path: "creator", select: "name image category" })
        .skip((page - 1) * limit).limit(limit).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .lean().exec();

    const completedTask = await Booking.find({ provider: provider._id, bookingStatus: { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED] } }).lean().exec();

    const reviewPagination = paginationHelper.calculatePagination({ limit: query.reviewLimit, page: query.reviewPage, sortOrder: query.reviewSortOrder });
    const reviews = await Review.find({ provider: provider._id })
        .select("-updatedAt -__v -provider -service")
        .populate({ path: "creator", select: "name image" })
        .skip((reviewPagination.page - 1) * reviewPagination.limit).limit(reviewPagination.limit).sort({ [reviewPagination.sortBy]: reviewPagination.sortOrder === 'asc' ? 1 : -1 })
        .lean().exec();

    let averageRating = 0;
    if (reviews.length > 0) {
        const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        averageRating = total / reviews.length;
    }

    // we can get validation requests by checking Verification
    // Need to implement but we skip here. Let's just say license is empty.
    const validationRequests = null;

    const isFavorite = await CustomerFavorite.find({ customer: new Types.ObjectId(user.id || user.authId), provider: provider._id }).select("provider").lean().exec();

    return {
        services,
        reviews: {
            overview: {
                averageRating,
                totalReviews: reviews.length,
                start: {
                    oneStar: reviews.filter(r => r.rating === 1).length,
                    twoStar: reviews.filter(r => r.rating === 2).length,
                    threeStar: reviews.filter(r => r.rating === 3).length,
                    fourStar: reviews.filter(r => r.rating === 4).length,
                    fiveStar: reviews.filter(r => r.rating === 5).length,
                }
            },
            all: reviews,
        },
        provider: {
            _id: provider._id,
            name: provider.name,
            image: provider.image,
            category: provider.category,
            experience: provider.experience,
            complitedTask: completedTask?.length ?? 0,
            rating: averageRating,
            isFavorite: isFavorite?.length > 0,
        },
        overView: {
            overView: provider.overView,
            language: provider.language,
            address: provider.address,
            serviceDestance: provider.distance,
            availableDay: provider.availableDay,
            startTime: provider.startTime,
            endTime: provider.endTime,
            license: "",
        }
    };
};

export const sendBooking = async (payload: JwtPayload, data: IBooking, req: Request) => {
    const service = await Service.find({ _id: data.service }).lean().exec();
    if (!service.length) throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");

    const provider = await User.findById(service[0].creator).lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const customer = await User.findById(payload.id || payload.authId).lean().exec();
    if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, "Customer not found!");

    const booking = await Booking.create({
        customer: customer._id,
        provider: provider._id,
        service: service[0]._id,
        date: data.date,
        location: data.location,
        address: data.address,
        specialNote: data.specialNote,
        bookingStatus: data.bookingStatus || BOOKING_STATUS.CREATED
    });

    // --- Paystack Implementation ---
    const url = await createPaystackCheckout(req, service[0].price, { bookingId: booking._id.toString(), providerId: provider._id.toString(), serviceId: service[0]._id.toString(), customerId: customer._id.toString() }, customer.email || "customer@example.com");

    await Booking.findByIdAndUpdate(booking._id, { transactionId: url.id });

    return url;
};

export const updateBooking = async (user: JwtPayload, id: Types.ObjectId, data: Partial<IBooking>) => {
    const booking = await Booking.findByIdAndUpdate(id, data, { new: true }).lean().exec();
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");
    return booking;
};

export const getBookings = async (user: JwtPayload, query: any, body: { status: "pending" | "upcoming" | "history" | "completed" | "cancelled" }) => {
    const statusFilter = body.status == "pending" ? BOOKING_STATUS.CREATED : body.status == "upcoming" ? { $in: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS] } : body.status == "completed" ? { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED, BOOKING_STATUS.AUTO_SETTLED] } : body.status == "cancelled" ? BOOKING_STATUS.CANCELLED : { $ne: BOOKING_STATUS.ACCEPTED };

    const bookingQuery = new QueryBuilder(
        Booking.find({
            customer: user.id || user.authId,
            isDeleted: { $ne: true },
            bookingStatus: statusFilter
        })
            .select("provider service createdAt date bookingStatus")
            .populate([{ path: "provider", select: "name image contact whatsApp" }, { path: "service", select: "name image price category subCategory" }]),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await bookingQuery.modelQuery.lean().exec();
    const meta = await bookingQuery.getPaginationInfo();

    const data = result.map((booking: any) => {
        return {
            _id: booking._id,
            image: booking.service?.image,
            category: booking.service?.category,
            price: booking.service?.price,
            providerName: booking.provider?.name,
            subCategory: booking.service?.subCategory,
            date: booking.date,
            status: booking.bookingStatus,
        };
    });

    return { meta, data };
};

export const cancelBooking = async (user: JwtPayload, id: Types.ObjectId) => {
    const bookingToCancel = await Booking.findById(id).lean().exec();
    if (!bookingToCancel) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    const booking: any = await BookingStateMachine.transitionState(id, "client", BOOKING_STATUS.CANCELLED);
    await Booking.populate(booking, "service");

    if (booking.isPaid && booking.transactionId) {
        // --- Paystack Implementation ---
        await refundPaystackTransaction(booking.transactionId);
    }

    await Payment.findOneAndUpdate({ booking: new Types.ObjectId(booking._id) }, { paymentStatus: PAYMENT_STATUS.REFUNDED }, { new: true }).lean().exec();

    await NotificationService.insertNotification({
        for: booking.provider,
        message: `Your booking for ${booking.service.subCategory} on ${booking.date} has been cancelled.`,
    });

    return booking;
};

export const addFavorite = async (user: JwtPayload, id: Types.ObjectId) => {
    const userId = user.id || user.authId;
    const isFavorite = await CustomerFavorite.find({ customer: new Types.ObjectId(userId), provider: id }).select("provider").lean().exec();
    if (isFavorite?.length > 0) {
        await CustomerFavorite.findOneAndDelete({ provider: id }).lean().exec();
        return { message: "Favorite removed successfully" };
    }

    const providerDef = await User.findById(id).lean().exec();
    if (!providerDef) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const provider = await CustomerFavorite.create({ customer: new Types.ObjectId(userId), provider: providerDef._id });
    return provider.provider;
};

export const removeFavorite = async (user: JwtPayload, id: Types.ObjectId) => {
    const provider = await CustomerFavorite.findOneAndDelete({ provider: id }).lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Favorite item is not exist on the list!");
    return provider.provider;
};

export const getFavorites = async (user: JwtPayload, query: Record<string, unknown>) => {
    const userId = user.id || user.authId;
    const favoriteQuery = new QueryBuilder(
        CustomerFavorite.find({ customer: new Types.ObjectId(userId) })
            .populate("provider", "name image overView")
            .select("provider"),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await favoriteQuery.modelQuery.lean().exec();
    const meta = await favoriteQuery.getPaginationInfo();

    return { meta, data };
};

export const bookScreen = async (id: string, query: any) => {
    const serviceQuery = new QueryBuilder(
        Service.find({ creator: new Types.ObjectId(id) })
            .select("image price category subCategory")
            .populate({ path: "creator", select: "name image" }),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await serviceQuery.modelQuery.lean().exec();
    const meta = await serviceQuery.getPaginationInfo();

    return { meta, data };
};

export const seeBooking = async (user: JwtPayload, id: string) => {
    const booking: any = await Booking.find({ _id: new Types.ObjectId(id) }).populate([
        { path: "service", select: "image price category subCategory whatsApp contact" },
        { path: "provider", select: "name image address category whatsApp contact" }
    ]).lean().exec();

    if (!booking.length) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    return {
        service: {
            ...booking[0].service,
            date: booking[0].date
        },
        details: {
            status: booking[0].bookingStatus,
            fee: booking[0].service.price,
            address: booking[0].address,
            specialNote: booking[0].specialNote,
            provider: booking[0].provider
        }
    };
};

export const getCategories = async (query: any) => {
    const categoryQuery = new QueryBuilder(
        Category.find({ isDeleted: false })
            .select("-createdAt -updatedAt -__v -isDeleted"),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await categoryQuery.modelQuery.lean().exec();
    const meta = await categoryQuery.getPaginationInfo();

    return { meta, data };
};

export const acceptBooking = async (user: JwtPayload, id: string) => {
    const bookingInfo: any = await Booking.find({ _id: new Types.ObjectId(id) }).populate([
        { path: "service", select: "image price category subCategory" },
        { path: "provider", select: "name image address category" }
    ]).lean().exec();

    if (!bookingInfo.length) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    const payment = await Payment.findOne({ booking: new Types.ObjectId(id) }).lean().exec();
    if (!payment) throw new ApiError(StatusCodes.NOT_FOUND, "Payment record not found!");

    // Transition state
    await BookingStateMachine.transitionState(id, "client", BOOKING_STATUS.CONFIRMED_BY_CLIENT);
    const booking = await BookingStateMachine.transitionState(id, "system", BOOKING_STATUS.SETTLED);

    await Payment.findByIdAndUpdate(payment._id, { paymentStatus: PAYMENT_STATUS.PAID }, { new: true }).lean().exec();

    const findProvider = await User.findById(bookingInfo[0].provider).lean().exec() as IUser;
    if (!findProvider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    await User.findByIdAndUpdate(bookingInfo[0].provider, { wallet: (findProvider.wallet || 0) + (payment.providerAmount || 0) }, { new: true }).lean().exec();

    await NotificationService.insertNotification({
        for: bookingInfo[0].provider,
        message: `Your booking for ${bookingInfo[0].service?.subCategory} on ${new Date(bookingInfo[0].date).toLocaleDateString()} has been completed.`,
    });
    return;
};

export const giveReview = async (user: JwtPayload, id: string, data: { feedback: string, rating: number }) => {
    const booking = await Booking.findById(id).populate("service provider").lean().exec();
    if (!booking) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");
    }

    const review = await Review.create({
        creator: new Types.ObjectId(user.id || user.authId),
        provider: (booking.provider as any)._id || booking.provider,
        review: data.feedback,
        rating: data.rating,
        service: (booking.service as any)._id || booking.service
    });

    if (!review) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Review not created!");
    }

    return review;
};

export const walteHistory = async (user: JwtPayload, query: any) => {
    const { startTime, endTime, ...rest } = query;
    const userId = user.id || user.authId;
    const provider = await User.findById(userId).lean().exec() as IUser;

    const filterOptionsQuery: any = {
        customer: new Types.ObjectId(userId),
        $or: [
            { paymentStatus: PAYMENT_STATUS.PAID },
            { paymentStatus: PAYMENT_STATUS.PROVIDER_CANCELLED },
            { paymentStatus: PAYMENT_STATUS.AUTO_SETTLED }
        ],
        ...((startTime && endTime) && {
            createdAt: {
                $gte: new Date(startTime),
                $lte: new Date(endTime)
            }
        })
    };

    const walletQuery = new QueryBuilder(
        Payment.find(filterOptionsQuery)
            .populate({ path: "service", select: "image category subCategory" }),
            // .select("service amount paymentStatus"),
        rest
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await walletQuery.modelQuery.lean().exec();
    const meta = await walletQuery.getPaginationInfo();

    return {
        meta,
        balance: provider.wallet,
        data
    };
};

export const paymentHistoryPage = async (id?: string) => {
    if (!id) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, "You must give the id!");

    const info: any = await Payment.find({ _id: new Types.ObjectId(id) })
        .populate("customer service")
        // .select("customer provider service booking amount paymentStatus createdAt")
        .lean().exec();

    const data = info[0];
    if (!data) throw new ApiError(StatusCodes.NOT_FOUND, "Payment details not found!");

    return {
        serviceInfo: {
            amount: data.service?.price,
            category: data.service?.category,
            subCategory: data.service?.subcategory,
            status: data.paymentStatus
        },
        userInformation: {
            name: data.customer?.name,
            location: data.customer?.address,
            email: data.customer?.email
        },
        paymentDetails: {
            totalAmount: data.amount,
            platformFee: data.platformFee,
            gatewayFee: data.gatewayFee,
            providerAmount: data.providerAmount,
            dateAndTime: data.createdAt
        }
    };
};

export const ClientServices = {
    getUserProfile,
    updateProfile,
    deleteProfile,
    getServices,
    getProviderById,
    sendBooking,
    updateBooking,
    getBookings,
    cancelBooking,
    addFavorite,
    removeFavorite,
    getFavorites,
    bookScreen,
    seeBooking,
    getCategories,
    acceptBooking,
    giveReview,
    walteHistory,
    paymentHistoryPage
};
