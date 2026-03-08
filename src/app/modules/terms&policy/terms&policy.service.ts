import { TermsModel } from "./terms&policy.model";
import { ITermsAndPolicy } from "./terms&policy.interface";

const getTerms = async () => {
    return TermsModel.findOne({ type: "terms" }).select("content -_id").lean().exec();
};

const getPolicy = async () => {
    return TermsModel.findOne({ type: "policy" }).select("content -_id").lean().exec();
};

const upsertTerms = async (content: string) => {
    return TermsModel.findOneAndUpdate(
        { type: "terms" },
        { type: "terms", content },
        { upsert: true, new: true }
    ).select("content -_id").lean().exec();
};

const upsertPolicy = async (content: string) => {
    return TermsModel.findOneAndUpdate(
        { type: "policy" },
        { type: "policy", content },
        { upsert: true, new: true }
    ).select("content -_id").lean().exec();
};

export const TermsAndPolicyServices = {
    getTerms,
    getPolicy,
    upsertTerms,
    upsertPolicy,
};
