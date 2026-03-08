import { JwtPayload } from "jsonwebtoken";
import { ISupport } from "./support.interface";
import { IPaginationOptions } from "../../../interfaces/pagination";
import { Support } from "./support.model";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enum/user";
import { Notification } from "../notification/notification.model";
import { emailQueue } from "../../../queues/email.queue";
import { Types } from "mongoose";
import { SupportStatus } from "../../../enum/support";
import { redisDB } from "../../../redis/connectedUsers";
import ApiError from "../../../errors/ApiError";
import { StatusCodes } from "http-status-codes";


const createSupport = async (user: JwtPayload, data: Partial<ISupport>) => {
    const support = await Support.create({
        attachment: data.attachment,
        description: data.description,
        title: data.title,
        user: user.id || user.authId
    });

    const [admins, currentUser] = await Promise.all([
        User.find({ role: USER_ROLES.ADMIN }),
        User.findById(user.id || user.authId).select("name email").lean()
    ]);

    admins.forEach(async (admin) => {
        const notification = await Notification.create({
            for: admin._id,
            message: `New Support Request from ${currentUser?.name || currentUser?.email}`,
            body: `New Support Request from ${currentUser?.name || currentUser?.email} with title: ${data.title}`
        });

        //@ts-ignore
        const socket = global.io;
        if (socket) {
            const socketId = await redisDB.get(`user:${admin._id}`);
            if (socketId) {
                socket.to(socketId).emit("notification", notification);
            }
        }
    });

    return support;
};

const getSupports = async (pagination: IPaginationOptions & { status?: string; search?: string }) => {
    const { page = 1, limit = 10, sortOrder = "desc", sortBy = "createdAt", status, search } = pagination;
    const skip = (page - 1) * limit;

    const queryFilter: any = {};

    if (status && status.trim() !== "") {
        queryFilter.status = status.toLowerCase() === "pending" ? SupportStatus.PENDING : SupportStatus.COMPLETED;
    }

    if (search && search.trim() !== "") {
        const userFilter: any = {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
        };

        const matchedUsers = await User.find(userFilter).select("_id").lean();
        const userIds = matchedUsers.map((u) => u._id);
        queryFilter.user = { $in: userIds };
    }

    const [data, total] = await Promise.all([
        Support.find(queryFilter)
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .select("-updatedAt -__v")
            .populate("user", "name email role category contact")
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
        Support.countDocuments(queryFilter),
    ]);

    return { meta: { page, limit, total, totalPage: Math.ceil(total / limit) }, data };
};

const markAsResolve = async (user: JwtPayload, supportId: string) => {
    const support = await Support.findById(new Types.ObjectId(supportId));
    if (!support) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Support not found");
    }

    support.status = SupportStatus.COMPLETED;
    await support.save();

    const data = "<div><h1>Your support ticket has been resolved.</h1><p>Thank you for reaching out.</p></div>";
    await emailQueue.add("email-send", {
        to: user.email,
        subject: "Support Gived",
        html: data,
    }, {
        removeOnComplete: true,
        removeOnFail: false,
    });

    return support;
};

export const SupportService = {
    createSupport,
    getSupports,
    markAsResolve
};
