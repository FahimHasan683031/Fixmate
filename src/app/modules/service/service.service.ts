import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../errors/ApiError";
import QueryBuilder from "../../builder/QueryBuilder";
import { IService } from "./service.interface";
import { Service } from "./service.model";
import { Verification } from "../verification/verification.model";
import { VERIFICATION_STATUS } from "../../../enum/user";

const createService = async (payload: JwtPayload, data: Partial<IService>) => {
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

const getAllServices = async (query: Record<string, unknown>) => {
    const serviceQuery = Service.find({ isDeleted: false }).populate({
        path: "creator",
        select: "name image address category experience"
    });

    const searchableFields = ["category", "subCategory", "expertise"];

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

const getSingleService = async (id: string) => {
    const result = await Service.findOne({ _id: id, isDeleted: false }).populate({
        path: "creator",
        select: "name image address category experience contact whatsApp nationality"
    });

    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    }
    return result;
};

const updateService = async (payload: JwtPayload, id: string, data: Partial<IService>) => {
    const result = await Service.findOneAndUpdate(
        { _id: id, creator: payload.authId },
        data,
        { new: true }
    );

    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found or unauthorized!");
    }
    return result;
};

const deleteService = async (payload: JwtPayload, id: string) => {
    const result = await Service.findOneAndUpdate(
        { _id: id, creator: payload.authId },
        { isDeleted: true },
        { new: true }
    );

    if (!result) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found or unauthorized!");
    }
    return result;
};

export const ServiceServices = {
    createService,
    getAllServices,
    getSingleService,
    updateService,
    deleteService
};
