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

    // TODO: Add notification logic once notification module is migrated

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
};
