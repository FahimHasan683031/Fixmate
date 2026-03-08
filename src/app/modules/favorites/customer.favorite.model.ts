import { model, Schema } from "mongoose";
import { ICustomerFavorite } from "./customer.favorite.interface";

const customerFavoriteSchema = new Schema<ICustomerFavorite>({
    customer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    provider: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true,
    versionKey: false
});

export const CustomerFavorite = model<ICustomerFavorite>("CustomerFavorite", customerFavoriteSchema);
