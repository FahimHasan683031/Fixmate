import { model, Schema } from "mongoose";
import { IVerificaiton } from "./verification.interface";
import { VERIFICATION_STATUS } from "../../../enum/user";

const verificaitonSchema = new Schema<IVerificaiton>({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    status: {
        type: String,
        enum: Object.values(VERIFICATION_STATUS),
        default: VERIFICATION_STATUS.UNVERIFIED
    },
    nid: {
        type: String,
        required: true
    },
    nidFront: {
        type: String,
        required: true
    },
    nidBack: {
        type: String,
        required: true
    },
    license: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    versionKey: false
})

export const Verification = model<IVerificaiton>("Verificaiton", verificaitonSchema);
