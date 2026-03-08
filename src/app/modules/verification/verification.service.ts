import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import ApiError from "../../../errors/ApiError";
import QueryBuilder from "../../builder/QueryBuilder";
import { IVerificaiton } from "./verification.interface";
import { Verification } from "./verification.model";
import { VERIFICATION_STATUS, USER_ROLES } from "../../../enum/user";
import { User } from "../user/user.model";

const sendVerificationRequest = async (payload: JwtPayload, data: Partial<IVerificaiton>) => {
    const userObjID = new mongoose.Types.ObjectId(payload.authId);
    const isVerificaitonExist = await Verification.findOne({ user: userObjID });

    if (isVerificaitonExist && isVerificaitonExist.status === VERIFICATION_STATUS.PENDING) {
        throw new ApiError(
            StatusCodes.EXPECTATION_FAILED,
            "You have already sent a request, please wait for approval."
        );
    }

    if (isVerificaitonExist && isVerificaitonExist.status === VERIFICATION_STATUS.APPROVED) {
        throw new ApiError(
            StatusCodes.EXPECTATION_FAILED,
            "Your profile is already verified."
        );
    }

    if (!isVerificaitonExist) {
        await Verification.create({
            ...data,
            status: VERIFICATION_STATUS.PENDING,
            user: payload.authId,
        });
    } else {
        await Verification.findByIdAndUpdate(isVerificaitonExist._id, {
            ...data,
            status: VERIFICATION_STATUS.PENDING,
        });
    }

    return data;
};

const getVerificationStatus = async (payload: JwtPayload) => {
    const userId = new mongoose.Types.ObjectId(payload.authId);
    const request = await Verification.findOne({ user: userId });
    const user = await User.findById(userId).select("name image category");

    return {
        user,
        verification: request || null,
    };
};

const getAllVerificationRequests = async (query: Record<string, unknown>) => {
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

const approveOrRejectRequest = async (id: string, status: "approve" | "reject") => {
    const verificationStatus = status === "approve" ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.REJECTED;

    const request = await Verification.findById(new Types.ObjectId(id));
    if (!request) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Request not found");
    }

    if (request.status !== VERIFICATION_STATUS.PENDING) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Request already ${request.status}`);
    }

    request.status = verificationStatus;
    await request.save();

    return request;
};

export const VerificationServices = {
    sendVerificationRequest,
    getVerificationStatus,
    getAllVerificationRequests,
    approveOrRejectRequest,
};
