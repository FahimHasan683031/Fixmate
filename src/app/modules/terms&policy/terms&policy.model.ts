import { model, Schema } from "mongoose";
import { ITermsAndPolicy } from "./terms&policy.interface";

const termsSchema = new Schema<ITermsAndPolicy>({
    type: {
        type: String,
        enum: ["terms", "policy"],
        required: true
    },
    content: {
        type: String,
        required: true
    }
});

export const TermsModel = model<ITermsAndPolicy>("Terms", termsSchema);
