import { StatusCodes } from "http-status-codes";
import mongoose, { Types, FilterQuery } from "mongoose";
import { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request } from "express";
import ApiError from "../../../errors/ApiError";
import unlinkFile from "../../../shared/unlinkFile";
import { IUser } from "../user/user.interface";
import { USER_STATUS, VERIFICATION_STATUS } from "../../../enum/user";
import { IService } from "../service/service.interface";
import { IPaginationOptions } from "../../../interfaces/pagination";
import { NotificationService } from "../notification/notification.service";
import { BOOKING_STATUS } from "../../../enum/booking";
import { PAYMENT_STATUS } from "../../../enum/payment";
import { transfers, accounts, accountLinks, refunds } from "../../../helpers/stripeHelper";
import { Verification } from "../verification/verification.model";
import { Service } from "../service/service.model";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { Review } from "../review/review.model";
import { Category } from "../category/category.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { BookingStateMachine } from "../booking/bookingStateMachine";


// Get Profile
export const profile = async (payload: JwtPayload) => {
    const provider = await User.findById(
        payload.id || payload.authId,
        "name image overView gender dateOfBirth nationality experience language contact whatsApp nationalId email address distance availableDay startTime endTime category"
    ).lean().exec();

    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");
    return provider;
};

// Get Provider Home Data
export const providerHome = async (payload: JwtPayload) => {
    const id = new Types.ObjectId(payload.id || payload.authId);
    const now = new Date();

    const [balanceResult, pendingBookingsResult, completedBookingsResult, availableDayResult] = await Promise.all([
        User.findById(id).select('wallet').lean(),
        Booking.countDocuments({ provider: id, bookingStatus: BOOKING_STATUS.REQUESTED }),
        Booking.countDocuments({ provider: id, bookingStatus: { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED] } }),
        Booking.find({
            provider: id,
            date: { $gte: now },
            bookingStatus: { $in: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS] }
        }).select('date').sort({ date: 1 }).limit(1).lean()
    ]);

    return {
        balance: balanceResult?.wallet || 0,
        pendigTask: pendingBookingsResult,
        complitedTask: completedBookingsResult,
        availableDay: availableDayResult.length > 0 ? availableDayResult[0].date : null
    };
};

// Update Profile
export const profileUpdate = async (payload: JwtPayload, data: Partial<IUser>) => {
    const provider = await User.findByIdAndUpdate(payload.id || payload.authId, data).lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");
    if (data.image && provider.image) unlinkFile(provider.image);

    const updatedProvider = await User.findById(payload.id || payload.authId).select("+image").lean().exec();
    return updatedProvider;
};

// Delete Profile
export const profileDelete = async (payload: JwtPayload, data: { password: string }) => {
    const provider = await User.findById(payload.id || payload.authId).select("+password").lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

    const isMatch = data.password && await bcrypt.compare(data.password, provider.password);
    if (!isMatch) throw new ApiError(StatusCodes.NOT_FOUND, "Password not match!");

    await Service.updateMany({ creator: provider._id }, { isDeleted: true }).lean().exec();
    await User.findByIdAndUpdate(provider._id, { status: USER_STATUS.DELETED }).lean().exec();
};

// Verification Status Check
export const verificaitonStatusCheck = async (payload: JwtPayload) => {
    const userId = new Types.ObjectId(payload.id || payload.authId);
    const request = await Verification.findOne({ user: userId }).lean().exec();
    const user = await User.findById(userId).lean().exec();

    return request ? {
        message: "This is your current request status",
        user: {
            name: user?.name,
            image: user?.image,
            category: user?.category,
            data: request
        }
    } : {
        message: "You don't have send the request!",
        user: {
            name: user?.name,
            image: user?.image,
            category: user?.category,
            data: null
        }
    };
};

// Send Verification Request
export const sendVerificaitonRequest = async (payload: JwtPayload, data: any) => {
    const userObjID = new Types.ObjectId(payload.id || payload.authId);
    const isVerifirequestExist = await Verification.findOne({ user: userObjID }).lean().exec();

    if (isVerifirequestExist && isVerifirequestExist.status == VERIFICATION_STATUS.PENDING) {
        throw new ApiError(StatusCodes.EXPECTATION_FAILED, "You are already sended the request so you must wait");
    }

    if (!data.license || !data.nid) throw new ApiError(StatusCodes.NOT_FOUND, "License or NID not found!");

    if (!isVerifirequestExist) {
        await Verification.create({ ...data, status: VERIFICATION_STATUS.PENDING, user: userObjID });
    } else {
        await Verification.findByIdAndUpdate(isVerifirequestExist._id, { ...data, status: VERIFICATION_STATUS.PENDING }).lean().exec();
    }

    const admins = await User.find({ role: "ADMIN" }).lean().exec();

    admins.forEach(async (admin) => {
        await NotificationService.insertNotification({
            for: admin._id,
            message: "A new verification request has been sent",
        });
    });

    return data;
};

// Get provider services
export const providerServices = async (payload: JwtPayload, query: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" }) => {
    const { page = 1, limit = 10, sortBy, sortOrder } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const sortStage: any = {};
    sortStage[sortBy || "createdAt"] = sortOrder === "desc" ? -1 : 1;

    const services = await Service.aggregate([
        { $match: { creator: new Types.ObjectId(payload.id || payload.authId), isDeleted: false } },
        { $lookup: { from: "reviews", localField: "_id", foreignField: "service", as: "reviews" } },
        {
            $addFields: {
                reviewCount: { $size: "$reviews" },
                averageRating: {
                    $cond: [
                        { $gt: [{ $size: "$reviews" }, 0] },
                        { $round: [{ $avg: "$reviews.rating" }, 1] },
                        0,
                    ],
                },
            },
        },
        { $project: { reviews: 0, __v: 0, updatedAt: 0, creator: 0 } },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: Number(limit) },
    ]);

    const total = await Service.countDocuments({ creator: payload.id || payload.authId, isDeleted: false });

    return { meta: { page: Number(page), limit: Number(limit), total }, data: services };
};

// Add service
export const addService = async (payload: JwtPayload, data: Partial<IService>) => {
    if (!data.image) throw new ApiError(StatusCodes.NOT_FOUND, "Image not found!");

    const verification = await Verification.findOne({ user: new Types.ObjectId(payload.id || payload.authId) }).lean().exec();

    if (!verification) {
        throw new ApiError(StatusCodes.FORBIDDEN, "You must verify your account first, please verify and try again.");
    }
    if (verification.status !== VERIFICATION_STATUS.APPROVED) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Your profile is not verified by the admin yet, verify and try again");
    }

    const result: any = await Service.create({ ...data, creator: new Types.ObjectId(payload.id || payload.authId) });

    const createdObj = result.toObject();
    delete createdObj.creator; delete createdObj.__v; delete createdObj.updatedAt; delete createdObj.createdAt; delete createdObj._id;
    return createdObj;
};

// Delete service
export const deleteService = async (payload: JwtPayload, id: string) => {
    const result: any = await Service.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).lean().exec();
    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");

    delete result.creator; delete result.__v; delete result.updatedAt; delete result.createdAt; delete result._id;
    return result;
};

// Update service
export const updateService = async (payload: JwtPayload, id: string, data: Partial<IService>) => {
    const result: any = await Service.findByIdAndUpdate(id, data, { new: true }).lean().exec();
    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");

    delete result.creator; delete result.__v; delete result.updatedAt; delete result.createdAt; delete result._id;
    return result;
};

// View service
export const viewService = async (payload: JwtPayload, id: string) => {
    const result: any = await Service.find({ creator: new Types.ObjectId(payload.id || payload.authId), _id: new Types.ObjectId(id) })
        .select("-__v -updatedAt -creator").lean().exec();

    if (!result.length) throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    delete result[0].createdAt; delete result[0]._id;
    return result[0];
};

// Get provider bookings
export const getBookings = async (user: JwtPayload, query: any, body: { status: "pending" | "upcoming" | "history" | "rejected" | "completed" | "cancelled" }) => {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const statusFilter =
        body.status === "pending" ? { $in: [BOOKING_STATUS.CREATED, BOOKING_STATUS.PAID, BOOKING_STATUS.REQUESTED] } :
            body.status === "upcoming" ? { $in: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS] } :
                body.status === "rejected" || body.status === "cancelled" ? { $in: [BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED] } :
                    body.status === "completed" ? { $in: [BOOKING_STATUS.COMPLETED_BY_PROVIDER, BOOKING_STATUS.CONFIRMED_BY_CLIENT, BOOKING_STATUS.SETTLED] } :
                        { $nin: [BOOKING_STATUS.CREATED, BOOKING_STATUS.PAID, BOOKING_STATUS.REQUESTED] };

    const bookingQuery = new QueryBuilder(
        Booking.find({
            provider: user.id || user.authId,
            isPaid: true,
            isDeleted: { $ne: true },
            bookingStatus: statusFilter
        }),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const bookings = await bookingQuery.modelQuery
        .populate([
            { path: "customer", select: "name image address contact whatsApp" },
            { path: "service", select: "name image price category subCategory" }
        ])
        .lean()
        .exec();
    const meta = await bookingQuery.getPaginationInfo();

    return { meta, data: bookings };
};

// Accept or Reject booking
export const actionBooking = async (user: JwtPayload, data: { bookId: string, action: "accept" | "reject" | "start" | "complete", reason?: string }) => {
    const bookingInfo: any = await Booking.find({ _id: new Types.ObjectId(data.bookId) }).lean().exec();

    if (!bookingInfo.length) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    if (data.action == "accept") {
        await BookingStateMachine.transitionState(data.bookId, "provider", BOOKING_STATUS.ACCEPTED);

        await NotificationService.insertNotification({
            for: bookingInfo[0].customer,
            message: `Your booking for ${bookingInfo[0].service?.subCategory} on ${new Date(bookingInfo[0].date).toLocaleDateString()} has been accepted.`,
        });

    } else if (data.action == "reject") {
        await BookingStateMachine.transitionState(data.bookId, "provider", BOOKING_STATUS.DECLINED, data.reason);

        if (bookingInfo[0].isPaid && bookingInfo[0].transactionId) {
            await refunds.create({ payment_intent: bookingInfo[0].transactionId });
        }

        await Payment.findOneAndUpdate({ booking: new Types.ObjectId(data.bookId) }, { paymentStatus: PAYMENT_STATUS.REFUNDED }, { new: true }).lean().exec();

        await NotificationService.insertNotification({
            for: bookingInfo[0].customer,
            message: `Your booking for ${bookingInfo[0].service?.subCategory} on ${new Date(bookingInfo[0].date).toLocaleDateString()} has been rejected.`,
        });
    } else if (data.action == "start") {
        await BookingStateMachine.transitionState(data.bookId, "provider", BOOKING_STATUS.IN_PROGRESS);

        await NotificationService.insertNotification({
            for: bookingInfo[0].customer,
            message: `Your provider has started working on ${bookingInfo[0].service?.subCategory}.`,
        });
    } else if (data.action == "complete") {
        await BookingStateMachine.transitionState(data.bookId, "provider", BOOKING_STATUS.COMPLETED_BY_PROVIDER);

        await NotificationService.insertNotification({
            for: bookingInfo[0].customer,
            message: `Your provider has completed ${bookingInfo[0].service?.subCategory}. Please confirm the completion.`,
        });
    }
};

// See booking
export const seeBooking = async (user: JwtPayload, id: string) => {
    const provider = await User.findById(user.id || user.authId).lean().exec();
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const booking: any = await Booking.find({ _id: new Types.ObjectId(id) })
        .populate([
            { path: "service", select: "image price category subCategory whatsApp contact" },
            { path: "customer", select: "name image address category whatsApp contact" }
        ]).lean().exec();

    if (!booking.length) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    return {
        service: { ...booking[0].service, date: booking[0].date },
        details: {
            distance: provider.distance,
            status: booking[0].bookingStatus,
            fee: booking[0].service.price,
            address: booking[0].address,
            specialNote: booking[0].specialNote,
            customer: booking[0].customer,
            paymentStatus: booking[0].paymentStatus
        }
    };
};

// Get categories
export const getCategories = async (query: Record<string, unknown>) => {
    const categoryQuery = new QueryBuilder(
        Category.find({ isDeleted: false }).select("-createdAt -updatedAt -__v -isDeleted"),
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

// Get Customer
export const getCustomer = async (id: string) => {
    const customer = await User.findById(id).select("name image address gender dateOfBirth nationality contact whatsApp").lean().exec();
    if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, "Customer not found!");
    return customer;
};

// Cancel booking
export const cancelBooking = async (user: JwtPayload, id: string) => {
    const bookingInfo: any = await Booking.find({ _id: new Types.ObjectId(id) }).lean().exec();
    if (!bookingInfo.length) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    await BookingStateMachine.transitionState(id, "provider", BOOKING_STATUS.CANCELLED);

    if (bookingInfo[0].isPaid && bookingInfo[0].transactionId) {
        await refunds.create({ payment_intent: bookingInfo[0].transactionId });
    }

    await Payment.findOneAndUpdate({ booking: new Types.ObjectId(id) }, { paymentStatus: PAYMENT_STATUS.REFUNDED }, { new: true }).lean().exec();

    const findProvider = await User.findById(bookingInfo[0].provider).lean().exec() as IUser;
    if (!findProvider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const service = await Service.findById(bookingInfo[0].service).lean().exec();
    const penaltyAmount = Number(((service?.price || 0) * 0.05).toFixed(2));

    const providerWallet = (findProvider.wallet || 0) - penaltyAmount;

    const providerUpdated = await User.findByIdAndUpdate(bookingInfo[0].provider, { wallet: providerWallet }, { new: true }).lean().exec();

    await Payment.create({
        booking: bookingInfo[0]._id,
        provider: bookingInfo[0].provider,
        customer: bookingInfo[0].customer,
        service: bookingInfo[0].service,
        amount: -penaltyAmount,
        paymentStatus: PAYMENT_STATUS.PROVIDER_CANCELLED
    });

    await NotificationService.insertNotification({
        for: bookingInfo[0].customer,
        message: `Your booking for ${service?.subCategory} on ${new Date(bookingInfo[0].date).toLocaleDateString()} has been cancelled by the provider.`,
    });

    return providerUpdated?.wallet;
};

// Get wallet
export const wallet = async (user: JwtPayload, query: any) => {
    const provider = await User.findById(user.id || user.authId).lean().exec() as IUser;
    const walletQuery = new QueryBuilder(
        Payment.find({
            provider: new Types.ObjectId(user.id || user.authId),
            $or: [
                { paymentStatus: PAYMENT_STATUS.PAID },
                { paymentStatus: PAYMENT_STATUS.PROVIDER_CANCELLED },
                { paymentStatus: PAYMENT_STATUS.WITHDRAWN }
            ]
        }),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const walletItems = await walletQuery.modelQuery
        .populate([{ path: "service", select: "image category subCategory" }])
        .lean()
        .exec();

    const meta = await walletQuery.getPaginationInfo();

    const data = walletItems.map((item: any) => ({
        ...item,
        amount: item.providerAmount || item.amount, // Show provider earnings for list view
    }));

    return { meta, balance: provider.wallet || 0, data };
};

// withdrawal
export const whitdrawal = async (user: JwtPayload, data: { amount: number }, req: Request) => {
    const provider = await User.findById(user.id || user.authId).lean().exec() as IUser;
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const maxWithdrawable = (provider.wallet || 0) * 0.9;
    if (data.amount > maxWithdrawable) throw new ApiError(StatusCodes.BAD_REQUEST, `Insufficient balance! You can withdraw up to ${maxWithdrawable.toFixed(2)}`);

    if (!provider.stripeAccountId) {
        const account = await accounts.create({
            type: "express",
            email: provider.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            },
            metadata: { userId: (user.id || user.authId).toString() }
        });
        const onboardLink = await accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.SERVER_DOMAIN}/api/v1/payment/account/refresh/${account.id}`,
            return_url: `${process.env.SERVER_DOMAIN}/api/v1/payment/account/${account.id}`,
            type: "account_onboarding"
        });
        return {
            message: "Please connect your account with stripe to withdraw money",
            url: onboardLink.url
        };
    }

    const amountAfterFee = Number((data.amount * 0.9).toFixed(2));

    await transfers.create({
        amount: amountAfterFee * 100,
        currency: 'usd',
        destination: provider.stripeAccountId as string,
        transfer_group: `provider_${provider._id}`
    });

    await User.findByIdAndUpdate(provider._id, { wallet: (provider.wallet || 0) - data.amount }).lean().exec();

    await Payment.create({
        amount: -data.amount,
        paymentStatus: PAYMENT_STATUS.WITHDRAWN,
        provider: provider._id
    });
    return;
};

// My reviews
export const myReviews = async (user: JwtPayload, query: IPaginationOptions) => {
    const reviewQuery = new QueryBuilder(
        Review.find({ provider: new Types.ObjectId(user.id || user.authId) }),
        query
    )
        .filter()
        .sort()
        .paginate()
        .fields();

    const reviews = await reviewQuery.modelQuery
        .populate("creator", "name image")
        .lean()
        .exec();

    let averageRating = 0;
    if (reviews.length > 0) {
        const total = reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0);
        averageRating = total / reviews.length;
    }

    const meta = await reviewQuery.getPaginationInfo();

    return {
        meta,
        overview: {
            averageRating,
            totalReviews: reviews.length,
            start: {
                oneStar: reviews.filter((r: any) => r.rating === 1).length,
                twoStar: reviews.filter((r: any) => r.rating === 2).length,
                threeStar: reviews.filter((r: any) => r.rating === 3).length,
                fourStar: reviews.filter((r: any) => r.rating === 4).length,
                fiveStar: reviews.filter((r: any) => r.rating === 5).length,
            }
        },
        data: reviews,
    };
};

// Get wallet history
export const walletHistory = async (user: JwtPayload, query: any) => {
    const { startTime, endTime, ...rest } = query;
    const provider = await User.findById(user.id || user.authId).lean().exec() as IUser;

    const filterOptionsQuery: FilterQuery<any> = {
        provider: new Types.ObjectId(user.id || user.authId),
        $or: [
            { paymentStatus: PAYMENT_STATUS.PAID },
            { paymentStatus: PAYMENT_STATUS.PROVIDER_CANCELLED },
            { paymentStatus: PAYMENT_STATUS.WITHDRAWN }
        ]
    };

    if (startTime && endTime) {
        filterOptionsQuery.createdAt = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const walletHistoryQuery = new QueryBuilder(Payment.find(filterOptionsQuery), rest)
        .filter()
        .sort()
        .paginate()
        .fields();

    const walletItems = await walletHistoryQuery.modelQuery
        .populate([{ path: "service", select: "image category subCategory" }])
        .lean()
        .exec();

    const meta = await walletHistoryQuery.getPaginationInfo();

    const data = walletItems.map((item: any) => ({
        ...item,
        amount: item.providerAmount || item.amount,
    }));

    return {
        meta,
        balance: provider.wallet,
        data: data
    };
};

export const ProviderServices = {
    profile,
    providerHome,
    profileUpdate,
    profileDelete,
    verificaitonStatusCheck,
    sendVerificaitonRequest,
    providerServices,
    addService,
    deleteService,
    updateService,
    viewService,
    getBookings,
    actionBooking,
    seeBooking,
    getCategories,
    getCustomer,
    cancelBooking,
    wallet,
    whitdrawal,
    myReviews,
    walletHistory
};
