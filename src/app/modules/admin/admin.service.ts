import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiError";
import { User } from "../user/user.model";
import { Verification } from "../verification/verification.model";
import { USER_STATUS, USER_ROLES, VERIFICATION_STATUS } from "../../../enum/user";
import { ICategory } from "../category/category.interface";
import { Category } from "../category/category.model";
import { ITermsAndPolicy } from "../terms&policy/terms&policy.interface";
import { TermsModel } from "../terms&policy/terms&policy.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { Review } from "../review/review.model";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { BOOKING_STATUS } from "../../../enum/booking";
import { PAYMENT_STATUS } from "../../../enum/payment";
import { Service } from "../service/service.model";
import { Notification } from "../notification/notification.model";
import { sendNotification } from "../../../helpers/SocketUtils";
import { redisDB } from "../../../redis/connectedUsers";
import { emailQueue } from "../../../queues/email.queue";

const overview = async (yearChart: string) => {
    const totalProviders = await User.countDocuments({ role: USER_ROLES.PROVIDER });
    const totalUsers = await User.countDocuments({ role: { $ne: USER_ROLES.ADMIN } });
    const upCommingOrders = await Booking.countDocuments({ bookingStatus: BOOKING_STATUS.ACCEPTED });

    const topProviders = await Review.aggregate([
        {
            $group: {
                _id: "$provider",
                reviewCount: { $sum: 1 },
                avgRating: { $avg: "$rating" },
                lastReviewAt: { $max: "$createdAt" },
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
            },
        },
        { $unwind: "$user" },
        {
            $match: {
                "user.role": USER_ROLES.PROVIDER,
            },
        },
        { $sort: { reviewCount: -1, avgRating: -1, lastReviewAt: -1 } },
        { $limit: 3 },
        {
            $project: {
                _id: 0,
                userId: "$user._id",
                name: "$user.name",
                image: "$user.image",
                category: "$user.category",
                reviewCount: 1,
                avgRating: { $round: ["$avgRating", 2] },
                lastReviewAt: 1,
            },
        },
    ]);

    const recentServices = await Booking.find({
        bookingStatus: BOOKING_STATUS.COMPLETED
    })
        .select("provider bookingStatus customer date")
        .populate("provider", "name contact address category")
        .populate("customer", "name")
        .populate("service", "price")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const payments = await Payment.find({
        booking: { $in: recentServices.map(b => b._id) }
    }).select("booking paymentId paymentStatus");

    const enhancedRecentServices = recentServices.map(service => {
        const payment = payments.find(p => p.booking.toString() === service._id.toString());
        return {
            ...service,
            paymentId: payment ? payment._id : null,
            paymentStatus: payment ? payment.paymentStatus : null,
        };
    });

    const [{ totalRevenue = 0 } = {}] = await Payment.aggregate([
        { $match: { paymentStatus: PAYMENT_STATUS.PAID } },
        {
            $addFields: {
                amountNum: {
                    $cond: [
                        { $isNumber: "$amount" },
                        "$amount",
                        { $toDouble: "$amount" },
                    ],
                },
            },
        },
        { $group: { _id: null, totalRevenue: { $sum: "$amountNum" } } },
    ]);

    const year = Number(yearChart) || new Date().getFullYear();

    const monthly = await Payment.aggregate([
        {
            $match: {
                paymentStatus: PAYMENT_STATUS.PAID,
                createdAt: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                },
            },
        },
        {
            $group: {
                _id: { $month: "$createdAt" },
                totalProfit: { $sum: "$amount" },
            },
        },
        { $sort: { "_id": 1 } },
    ]);

    const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const result = monthNames.map((name, index) => {
        const monthIndex = index + 1;
        const found = monthly.find((m) => m._id === monthIndex);
        return {
            month: name,
            profit: found ? found.totalProfit : 0,
        };
    });

    return {
        totalUsers,
        totalProviders,
        upCommingOrders,
        totalRevenue,
        recentServices: enhancedRecentServices,
        topProviders,
        monthlyEarning: result,
    };
};

const getUsers = async (query: Record<string, unknown>) => {
    const userQuery = User.find({
        role: { $ne: USER_ROLES.ADMIN },
        status: { $ne: USER_STATUS.DELETED },
    }).select("name _id contact address role category status email");

    const searchableFields = ["name", "email", "contact"];

    const userQueryBuilder = new QueryBuilder(userQuery, query)
        .search(searchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await userQueryBuilder.modelQuery.lean().exec();
    const meta = await userQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const getUser = async (id: string) => {
    const result = await User.findById(new Types.ObjectId(id)).lean().exec();
    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    return result;
};

const blockAndUnblockUser = async (id: string, block: "block" | "unblock" | "delete") => {
    const status =
        block === "block" ? USER_STATUS.BLOCKED : block === "unblock" ? USER_STATUS.ACTIVE : block === "delete" ? USER_STATUS.DELETED : USER_STATUS.BLOCKED;

    const result = await User.findByIdAndUpdate(
        new Types.ObjectId(id),
        { status },
        { new: true }
    )
        .lean()
        .exec();

    if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
    return result.status;
};

const getRequests = async (query: Record<string, unknown>) => {
    const verificationQuery = Verification.find().populate({
        path: "user",
        select: "name image category email contact nationalId",
    });

    const verificationQueryBuilder = new QueryBuilder(verificationQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await verificationQueryBuilder.modelQuery.lean().exec();
    const meta = await verificationQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const approveOrReject = async (id: string, status: "approve" | "reject") => {
    if (status !== "approve" && status !== "reject") {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid status");
    }

    const request = await Verification.findById(new Types.ObjectId(id)).lean().exec();
    if (!request) throw new ApiError(StatusCodes.BAD_REQUEST, "Request not found");

    if (
        request.status === VERIFICATION_STATUS.APPROVED ||
        request.status === VERIFICATION_STATUS.REJECTED
    ) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Request already ${request.status}`);
    }

    const updated = await Verification.findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        {
            status: status === "approve" ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.REJECTED,
        },
        { new: true }
    )
        .lean()
        .exec();

    if (!updated) throw new ApiError(StatusCodes.BAD_REQUEST, "Request not found");

    const message = await Notification.create({
        receiver: updated.user,
        message:
            "Your verification request has been " +
            (status === "approve" ? "approved" : "rejected"),
        type: "USER"
    });

    const socket = (global as any).io;
    await sendNotification(socket, message);

    const isProviderOnline = await redisDB.get(`user:${updated.user}`);
    if (!isProviderOnline) {
        const provider = await User.findById(updated.user).lean().exec() as any;
        await emailQueue.add(
            "push-notification",
            {
                notification: {
                    title:
                        "Your verification request has been " +
                        (status === "approve" ? "approved" : "rejected"),
                    body: `Admin has ${status === "approve" ? "approved" : "rejected"} your verification request`,
                },
                token: provider?.fcmToken,
            },
            { removeOnComplete: true, removeOnFail: false }
        );
    }

    return updated.status;
};

const addNewCategory = async (category: ICategory) => {
    if (!category.image) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Category image is required");
    }
    return Category.create(category);
};

const getCategories = async (query: Record<string, unknown>) => {
    const categoryQuery = Category.find({ isDeleted: false }).select("name image subCategory");

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


const updateCategory = async (id: string, category: ICategory) => {
    const result = await Category.findByIdAndUpdate(new Types.ObjectId(id), category, {
        new: true,
    })
        .lean()
        .exec();
    if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, "Category not found");
    return result;
};

const deleteCategory = async (id: string) => {
    const result = await Category.findByIdAndUpdate(
        new Types.ObjectId(id),
        { isDeleted: true },
        { new: true }
    )
        .lean()
        .exec();
    if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, "Category not found");
    return result;
};

const getTerms = async () => {
    return TermsModel.findOne({ type: "terms" }).select("content -_id").lean().exec();
};

const getPolicy = async () => {
    return TermsModel.findOne({ type: "policy" }).select("content -_id").lean().exec();
};

const upsertPolicy = async (policy: Partial<ITermsAndPolicy>) => {
    const existing = await TermsModel.findOne({ type: "policy" }).lean().exec();
    if (!existing) {
        return TermsModel.create({ type: "policy", content: policy.content });
    }
    return TermsModel.findOneAndUpdate(
        { type: "policy" },
        { content: policy.content ?? existing.content },
        { new: true }
    )
        .select("content")
        .lean()
        .exec();
};

const upsertTerms = async (terms: Partial<ITermsAndPolicy>) => {
    const existing = await TermsModel.findOne({ type: "terms" }).lean().exec();
    if (!existing) {
        return TermsModel.create({ type: "terms", content: terms.content });
    }
    return TermsModel.findOneAndUpdate(
        { type: "terms" },
        { content: terms.content ?? existing.content },
        { new: true }
    )
        .select("content")
        .lean()
        .exec();
};

const find = async (query: any) => {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", search, compo } = query;
    const skip = (page - 1) * limit;

    const userFilter: any = {};
    if (search) userFilter.name = { $regex: search, $options: "i" };

    const [users, totalUsers] = await Promise.all([
        User.find(userFilter)
            .select("name image category email contact nationalId")
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy as string]: sortOrder === "asc" ? 1 : -1 })
            .lean()
            .exec(),
        User.countDocuments(userFilter),
    ]);

    if (compo === "user") {
        return { meta: { page, limit, total: totalUsers, totalPage: Math.ceil(totalUsers / limit) }, data: users };
    }

    if (compo === "verification") {
        const data = await Verification.find({ user: { $in: users.map((u: any) => u._id) } })
            .select("user status")
            .populate({ path: "user", select: "name image category email contact nationalId" })
            .lean()
            .exec();

        return { meta: { page, limit, total: totalUsers, totalPage: Math.ceil(totalUsers / limit) }, data };
    }

    return { meta: { page, limit, total: 0, totalPage: 0 }, data: [] };
};

const bookingData = async (query: any) => {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", status, search } = query;

    let queryDB: any = {};

    if (status) {
        switch (status.toLowerCase()) {
            case "accepted":
                queryDB.bookingStatus = BOOKING_STATUS.ACCEPTED;
                break;
            case "cancelled":
                queryDB.bookingStatus = BOOKING_STATUS.CANCELLED;
                break;
            case "rejected":
                queryDB.bookingStatus = BOOKING_STATUS.REJECTED;
                break;
            case "pending":
                queryDB.bookingStatus = BOOKING_STATUS.PENDING;
                break;
            case "completed":
                queryDB.bookingStatus = BOOKING_STATUS.COMPLETED;
                break;
        }
    }

    if (search && search.trim() !== "") {
        const providerIds = (await User.find({ name: { $regex: search, $options: "i" } }).select("_id")).map(u => u._id);
        const customerIds = (await User.find({ name: { $regex: search, $options: "i" } }).select("_id")).map(u => u._id);
        const serviceIds = (await Service.find({ category: { $regex: search, $options: "i" } }).select("_id")).map(s => s._id);

        queryDB.$or = [
            { provider: { $in: providerIds } },
            { customer: { $in: customerIds } },
            { service: { $in: serviceIds } },
        ];
    }

    const [data, total] = await Promise.all([
        Booking.find(queryDB)
            .select("provider bookingStatus customer date service")
            .populate("provider", "name contact address category")
            .populate("customer", "name")
            .populate("service", "name price category")
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        Booking.countDocuments(queryDB),
    ]);

    const payments = await Payment.find({
        booking: { $in: data.map(b => b._id) }
    }).select("booking paymentId paymentStatus");

    const enhancedData = data.map(booking => {
        const payment = payments.find(p => p.booking.toString() === booking._id.toString());
        return {
            ...booking,
            paymentId: payment ? payment._id : null,
            paymentStatus: payment ? payment.paymentStatus : null,
        };
    });

    return { meta: { page, limit, total, totalPage: Math.ceil(total / limit) }, data: enhancedData };
};

const generateMultiInvoices = async (data: { bookingIds: string[] }) => {
    if (!Array.isArray(data.bookingIds) || data.bookingIds.length === 0) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "You must provide an array of booking IDs");
    }

    const allOrders = await Booking.find({
        _id: { $in: data.bookingIds.map((id: string) => new Types.ObjectId(id)) }
    }).populate("customer", "name contact address")
        .populate("service", "name price category subCategory")
        .populate("provider", "name")
        .lean()
        .exec();

    if (allOrders.length === 0)
        throw new ApiError(StatusCodes.NOT_FOUND, "No bookings found");

    const payments = await Payment.find({
        booking: { $in: allOrders.map((b: any) => b._id) }
    })
        .select("booking amount paymentStatus createdAt")
        .lean()
        .exec();

    const paymentByBooking: Record<string, any> = {};
    for (const p of payments) {
        paymentByBooking[p.booking.toString()] = p;
    }

    const formattedOrders: any[] = allOrders.map((item: any) => ({
        service: {
            price: item.service?.price || 0,
            category: item.service?.category || "N/A",
            subcategory: item.service?.subCategory || "N/A",
        },
        customer: {
            name: item.customer?.name || "N/A",
            address: item.customer?.address || "N/A",
            email: item.customer?.email || "N/A",
        },
        provider: {
            name: item.provider?.name || "N/A",
        },
        amount: paymentByBooking[item._id.toString()]?.amount ?? item.service?.price ?? 0,
        paymentStatus: paymentByBooking[item._id.toString()]?.paymentStatus ?? item.bookingStatus ?? "PENDING",
        createdAt: paymentByBooking[item._id.toString()]?.createdAt ?? item.createdAt ?? new Date(),
        id: item._id?.toString() || `inv-${Date.now()}`
    }));

    return formattedOrders;
};

export const AdminServices = {
    getUsers,
    getUser,
    blockAndUnblockUser,
    getRequests,
    approveOrReject,
    addNewCategory,
    getCategories,
    updateCategory,
    deleteCategory,
    getTerms,
    getPolicy,
    upsertPolicy,
    upsertTerms,
    overview,
    find,
    bookingData,
    generateMultiInvoices,
};
