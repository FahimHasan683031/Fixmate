import { model, Schema } from 'mongoose';
import { ICustomerFavorite } from './customer.favorite.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const customerFavoriteSchema = new Schema<ICustomerFavorite>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

customerFavoriteSchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('FAV');
  }
  next();
});

export const CustomerFavorite = model<ICustomerFavorite>(
  'CustomerFavorite',
  customerFavoriteSchema,
);
