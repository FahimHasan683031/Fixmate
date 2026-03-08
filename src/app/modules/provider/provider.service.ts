import mongoose, { Types } from "mongoose";
import { JwtPayload } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiError";
import { User } from "../user/user.model";
import { IUser } from "../user/user.interface";
import { USER_STATUS, VERIFICATION_STATUS } from "../../../enum/user";
import { Verification } from "../verification/verification.model";
import { Service } from "../service/service.model";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { IService } from "../service/service.interface";
import { BOOKING_STATUS } from "../../../enum/booking";
import { PAYMENT_STATUS } from "../../../enum/payment";
import { Notification } from "../notification/notification.model";
import { Review } from "../review/review.model";
import { Category } from "../category/category.model";

const profile = async (payload: JwtPayload) => {
    const provider = await User.findById(payload.authId).select(
        "name image overView gender dateOfBirth nationality experience language contact whatsApp nationalId email address distance availableDay startTime endTime category"
    );
    if (!provider) {
        throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");
    }
    return provider;
};

const profileUpdate = async (payload: JwtPayload, data: Partial<IUser>) => {
    const provider = await User.findOneAndUpdate(
        { _id: payload.authId, status: { $ne: USER_STATUS.DELETED } },
        data,
        { new: true }
    ).select("+image");

    if (!provider) {
        throw new ApiError(StatusCodes.NOT_FOUND, "User not found!");
    }
    return provider;
};

const verificaitonStatusCheck = async (payload: JwtPayload) => {
    const userId = new mongoose.Types.ObjectId(payload.authId);
    const request = await Verification.findOne({ user: userId });
    const user = await User.findById(userId);

    return request
        ? {
            message: "This is your current request status",
            user: {
                name: user?.name,
                image: user?.image,
                category: user?.category,
                data: request,
            },
        }
        : {
            message: "You don't have send the request!",
            user: {
                name: user?.name,
                image: user?.image,
                category: user?.category,
                data: null,
            },
        };
};

const sendVerificaitonRequest = async (payload: JwtPayload, data: any) => {
    const userObjID = new mongoose.Types.ObjectId(payload.authId);
    const isVerifirequestExist = await Verification.findOne({ user: userObjID });

    if (isVerifirequestExist && isVerifirequestExist.status === VERIFICATION_STATUS.PENDING) {
        throw new ApiError(
            StatusCodes.EXPECTATION_FAILED,
            "You have already sent a request, please wait for approval."
        );
    }

    if (!isVerifirequestExist) {
        await Verification.create({
            ...data,
            status: VERIFICATION_STATUS.PENDING,
            user: payload.authId,
        });
    } else {
        await Verification.findByIdAndUpdate(isVerifirequestExist._id, {
            ...data,
            status: VERIFICATION_STATUS.PENDING,
        });
    }

    return data;
};

const providerServices = async (payload: JwtPayload, query: Record<string, unknown>) => {
    const serviceQuery = Service.find({ creator: payload.authId, isDeleted: false });
    const searchableFields = ["category", "subCategory"];

    const serviceQueryBuilder = new QueryBuilder(serviceQuery, query)
        .search(searchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await serviceQueryBuilder.modelQuery.lean().exec();
    const meta = await serviceQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const addService = async (payload: JwtPayload, data: Partial<IService>) => {
    const verification = await Verification.findOne({ user: payload.authId });

    if (!verification || verification.status !== VERIFICATION_STATUS.APPROVED) {
        throw new ApiError(
            StatusCodes.FORBIDDEN,
            "Your profile is not verified yet, verify and try again"
        );
    }

    const result = await Service.create({ ...data, creator: payload.authId });
    return result;
};

const deleteService = async (payload: JwtPayload, id: string) => {
    const result = await Service.findOneAndUpdate(
        { _id: id, creator: payload.authId },
        { isDeleted: true },
        { new: true }
    );
    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    }
    return result;
};

const updateService = async (
    payload: JwtPayload,
    id: string,
    data: Partial<IService>
) => {
    const result = await Service.findOneAndUpdate(
        { _id: id, creator: payload.authId },
        data,
        { new: true }
    );
    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    }
    return result;
};

const viewService = async (payload: JwtPayload, id: string) => {
    const result = await Service.findOne({
        _id: id,
        creator: payload.authId,
        isDeleted: false,
    }).select("-__v -updatedAt -creator");

    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    }
    return result;
};

const getBookings = async (
    user: JwtPayload,
    query: Record<string, unknown>,
    body: { status: string }
) => {
    const filter: any = {
        provider: user.authId,
        isPaid: true,
        isDeleted: { $ne: true },
    };

    if (body.status === "pending") {
        filter.bookingStatus = BOOKING_STATUS.PENDING;
    } else if (body.status === "upcoming") {
        filter.bookingStatus = BOOKING_STATUS.ACCEPTED;
    } else if (body.status === "rejected" || body.status === "cancelled") {
        filter.bookingStatus = {
            $in: [BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED],
        };
    } else if (body.status === "completed") {
        filter.bookingStatus = BOOKING_STATUS.COMPLETED;
    } else {
        filter.bookingStatus = { $ne: BOOKING_STATUS.PENDING };
    }

    const bookingQuery = Booking.find(filter)
        .populate({
            path: "customer",
            select: "name image address contact whatsApp",
        })
        .populate({
            path: "service",
            select: "name image price category subCategory",
        });

    const bookingQueryBuilder = new QueryBuilder(bookingQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await bookingQueryBuilder.modelQuery.lean().exec();
    const meta = await bookingQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const actionBooking = async (
    user: JwtPayload,
    data: { bookId: string; action: "accept" | "reject"; reason?: string }
) => {
    const booking = await Booking.findOne({
        _id: data.bookId,
        provider: user.authId,
    });

    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");
    if (booking.bookingStatus !== BOOKING_STATUS.PENDING)
        throw new ApiError(StatusCodes.NOT_FOUND, "Booking already interacted!");

    if (data.action === "accept") {
        booking.bookingStatus = BOOKING_STATUS.ACCEPTED;
        await booking.save();

        await Notification.create({
            receiver: booking.customer,
            title: "Booking Accepted",
            message: "Your Booking has been accepted",
            referenceId: booking._id,
            model_type: "Booking",
        });

        // Push notification logic would go here if PushNotificationService exists
    } else if (data.action === "reject") {
        booking.bookingStatus = BOOKING_STATUS.REJECTED;
        booking.rejectReason = data.reason || "";
        await booking.save();

        await Notification.create({
            receiver: booking.customer,
            title: "Booking Rejected",
            message: `Your Booking has been rejected. Reason: ${data.reason || "N/A"}`,
            referenceId: booking._id,
            model_type: "Booking",
        });
    }

    return booking;
};

const seeBooking = async (user: JwtPayload, id: string) => {
    const provider = await User.findById(user.authId);
    if (!provider)
        throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const booking = await Booking.findOne({ _id: id, provider: user.authId })
        .populate({
            path: "service",
            select: "image price category subCategory whatsApp contact",
        })
        .populate({
            path: "customer",
            select: "name image address category whatsApp contact",
        });

    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    return {
        service: {
            ...booking.service,
            date: booking.date,
        },
        details: {
            distance: provider.distance,
            status: booking.bookingStatus,
            fee: (booking.service as any).price,
            address: booking.address,
            specialNote: booking.specialNote,
            customer: booking.customer,
            paymentStatus: booking.isPaid ? "PAID" : "UNPAID",
        },
    };
};

const getCategories = async (query: Record<string, unknown>) => {
    const categoryQuery = Category.find({});
    const categoryQueryBuilder = new QueryBuilder(categoryQuery, query)
        .search(["name"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await categoryQueryBuilder.modelQuery.lean().exec();
    const meta = await categoryQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const getCustomer = async (id: string) => {
    const customer = await User.findById(id).select(
        "name image address gender dateOfBirth nationality contact whatsApp"
    );
    if (!customer) throw new ApiError(StatusCodes.NOT_FOUND, "Customer not found!");
    return customer;
};

const cancelBooking = async (user: JwtPayload, id: string) => {
    const booking = await Booking.findOne({ _id: id, provider: user.authId });
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");

    if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED].includes(booking.bookingStatus)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Booking already ${booking.bookingStatus.toLowerCase()}`);
    }

    booking.bookingStatus = BOOKING_STATUS.CANCELLED;
    await booking.save();

    const provider = await User.findById(user.authId);
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    // Cancellation fee logic
    const cancellationFee = (booking as any).totalAmount * 0.05;
    provider.wallet = (provider.wallet || 0) - cancellationFee;
    await provider.save();

    await Payment.create({
        booking: booking._id,
        provider: booking.provider,
        customer: booking.customer,
        service: booking.service,
        amount: cancellationFee,
        status: PAYMENT_STATUS.CANCELLED,
    });

    await Notification.create({
        receiver: booking.customer,
        title: "Booking Cancelled",
        message: "Your Booking has been cancelled by provider",
        referenceId: booking._id,
        model_type: "Booking",
    });

    return provider.wallet;
};

const wallet = async (user: JwtPayload, query: Record<string, unknown>) => {
    const paymentQuery = Payment.find({
        provider: user.authId,
        status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CANCELLED] },
    }).populate({
        path: "service",
        select: "image category subCategory",
    });

    const paymentQueryBuilder = new QueryBuilder(paymentQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const history = await paymentQueryBuilder.modelQuery.lean().exec();
    const meta = await paymentQueryBuilder.getPaginationInfo();

    const processedHistory = history.map((item: any) => ({
        ...item,
        amount: Number((item.amount * 0.9).toFixed(2)), // 10% deduction example
    }));

    const balance = processedHistory
        .filter((item: any) => item.status === PAYMENT_STATUS.PAID)
        .reduce((sum: number, item: any) => sum + item.amount, 0);

    return {
        balance: Number(balance.toFixed(2)),
        history: processedHistory,
        meta,
    };
};

const withdrawal = async (user: JwtPayload, data: { amount: number }) => {
    const provider = await User.findById(user.authId);
    if (!provider) throw new ApiError(StatusCodes.NOT_FOUND, "Provider not found!");

    const maxWithdrawable = (provider.wallet || 0) * 0.9;
    if (data.amount > maxWithdrawable) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Insufficient balance! Max withdrawable: ${maxWithdrawable.toFixed(2)}`);
    }

    // Connect account logic placeholder
    if (!provider.stripeAccountId) {
        return {
            message: "Connect stripe account to withdraw",
            url: "https://stripe.com/connect", // Placeholder
        };
    }

    // Stripe transfer logic placeholder
    provider.wallet = (provider.wallet || 0) - data.amount;
    await provider.save();

    await Payment.create({
        provider: provider._id,
        amount: -data.amount,
        status: PAYMENT_STATUS.WITHDRAWN,
    });

    return { message: "Withdrawal request processed successfully" };
};

const myReviews = async (user: JwtPayload, query: Record<string, unknown>) => {
    const reviewQuery = Review.find({ provider: user.authId }).populate({
        path: "customer",
        select: "name image",
    });

    const reviewQueryBuilder = new QueryBuilder(reviewQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await reviewQueryBuilder.modelQuery.lean().exec();
    const meta = await reviewQueryBuilder.getPaginationInfo();

    const ratingsCount = {
        oneStar: await Review.countDocuments({ provider: user.authId, rating: 1 }),
        twoStar: await Review.countDocuments({ provider: user.authId, rating: 2 }),
        threeStar: await Review.countDocuments({ provider: user.authId, rating: 3 }),
        fourStar: await Review.countDocuments({ provider: user.authId, rating: 4 }),
        fiveStar: await Review.countDocuments({ provider: user.authId, rating: 5 }),
    };

    const totalReviews = await Review.countDocuments({ provider: user.authId });
    const averageRating = totalReviews > 0 ? (await Review.aggregate([
        { $match: { provider: new mongoose.Types.ObjectId(user.authId) } },
        { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]))[0]?.avg || 0 : 0;

    return {
        overview: {
            averageRating: Number(averageRating.toFixed(1)),
            totalReviews,
            stars: ratingsCount,
        },
        reviews: data,
        meta,
    };
};

const walletHistory = async (user: JwtPayload, query: Record<string, unknown>) => {
    const { startTime, endTime, ...rest } = query;
    const filter: any = {
        provider: user.authId,
        status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CANCELLED] },
    };

    if (startTime && endTime) {
        filter.createdAt = {
            $gte: new Date(startTime as string),
            $lte: new Date(endTime as string),
        };
    }

    const paymentQuery = Payment.find(filter).populate({
        path: "service",
        select: "image category subCategory",
    });

    const paymentQueryBuilder = new QueryBuilder(paymentQuery, rest)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await paymentQueryBuilder.modelQuery.lean().exec();
    const meta = await paymentQueryBuilder.getPaginationInfo();

    const provider = await User.findById(user.authId);

    return {
        balance: provider?.wallet || 0,
        history: data,
        meta,
    };
};

export const ProviderServices = {
    profile,
    profileUpdate,
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
    withdrawal,
    myReviews,
    walletHistory
};


