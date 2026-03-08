import { model, Schema } from "mongoose";
import { IService } from "./service.interface";

const serviceSchema = new Schema<IService>({
    creator: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subCategory: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    expertise: {
        type: String,
        default: ""
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

serviceSchema.index({ category: 1, subCategory: 1 });
serviceSchema.index({ creator: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ createdAt: -1 });

export const Service = model<IService>("Service", serviceSchema);
