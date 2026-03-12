import { JwtPayload } from "jsonwebtoken";
import { IPaginationOptions } from "../../../interfaces/pagination";
import { ISupport } from "./support.interface";
import { Support } from "./support.model";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enum/user";
import { NotificationService } from "../notification/notification.service";
import { Types } from "mongoose";
import { SupportStatus } from "../../../enum/support";
import ApiError from "../../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { emailHelper } from "../../../helpers/emailHelper";
import QueryBuilder from "../../builder/QueryBuilder";

const createSupport = async (user: JwtPayload, data: Partial<ISupport>) => {
    const support = await Support.create({
        attachment: data.attachment,
        description: data.description,
        title: data.title,
        user: new Types.ObjectId(user.id || user.authId)
    });

    const [getAdmins, getUser] = await Promise.all([
        User.find({ role: USER_ROLES.ADMIN }),
        User.findById(user.id || user.authId).select("name email").lean()
    ]);

    getAdmins.forEach(async element => {
        await NotificationService.insertNotification({
            for: element._id,
            message: `New Support Request from ${getUser?.name || getUser?.email} with title: ${data.title}`,
        });
    });

    return support;
};

const getSupports = async (query: Record<string, unknown>) => {
    const { status, search, ...queryObj } = query;
    const queryFilter: any = {};

    if (status && String(status).trim() !== "") {
        queryFilter.status = String(status).toUpperCase() === "PENDING" ? SupportStatus.PENDING : SupportStatus.COMPLETED;
    }

    if (search && String(search).trim() !== "") {
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

    const supportQuery = new QueryBuilder<ISupport>(
        Support.find(queryFilter)
            .populate("user", "name email role category contact")
            .select("-updatedAt -__v") as any,
        queryObj as Record<string, unknown>
    )
        .search(["title", "description"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await supportQuery.modelQuery.lean().exec();
    const meta = await supportQuery.getPaginationInfo();

    return {
        meta,
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

    const dataEmail = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
            <h1 style="color: #0062EB;">Fixmate Support</h1>
            <p style="font-size: 16px; color: #333;">Your support ticket has been resolved.</p>
            <p style="font-size: 14px; color: #666;">Thank you for choosing Fixmate. We are glad to have helped you.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">This is an automated message from Fixmate Support System.</p>
        </div>
    `;
    await emailHelper.sendEmail({
        to: user.email,
        subject: "Support Ticket Resolved - Fixmate",
        html: dataEmail,
    });

    return support;
};

export const SupportServices = {
    createSupport,
    getSupports,
    markAsResolve
};
