import { JwtPayload } from "jsonwebtoken";
import { IPaginationOptions } from "../../../interfaces/pagination";
import { ISupport } from "./support.interface";
import { Support } from "./support.model";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enum/user";
import { Notification } from "../notification/notification.model";
import { Types } from "mongoose";
import { SupportStatus } from "../../../enum/support";
import { redisDB } from "../../../redis/connectedUsers";
import ApiError from "../../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { emailQueue } from "../../../queues/email.queue";

const createSupport = async (user: JwtPayload, data: Partial<ISupport>) => {
    const support = await Support.create({
        attachment: data.attachment,
        description: data.description,
        title: data.title,
        user: user.id || user.authId
    });

    const [getAdmins, getUser] = await Promise.all([
        User.find({ role: USER_ROLES.ADMIN }),
        User.findById(user.id || user.authId).select("name email").lean()
    ]);

    getAdmins.forEach(async element => {
        const notification = await Notification.create({
            receiver: element._id,
            title: `New Support Request`,
            message: `New Support Request from ${getUser?.name || getUser?.email} with title: ${data.title}`,
            type: "ADMIN"
        });

        //@ts-ignore
        const socket = global.io;
        if (socket) {
            const userId = notification.receiver;
            const socketId = await redisDB.get(`user:${userId}`);
            if (socketId) {
                socket.to(socketId).emit("notification", notification);
            }
        }
    });

    return support;
};

const getSupports = async (pagination: IPaginationOptions & { status?: string; search?: string }) => {
    const {
        page = 1,
        limit = 10,
        sortOrder = "desc",
        sortBy = "createdAt",
        status,
        search,
    } = pagination;

    const skip = (page - 1) * limit;
    const queryFilter: any = {};

    if (status && status.trim() !== "") {
        queryFilter.status = status.toUpperCase() === "PENDING" ? SupportStatus.PENDING : SupportStatus.COMPLETED;
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

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPage: Math.ceil(total / limit)
        },
        data
    };
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

export const SupportServices = {
    createSupport,
    getSupports,
    markAsResolve
};
