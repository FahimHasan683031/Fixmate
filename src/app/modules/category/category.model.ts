import { Schema, model } from 'mongoose';
import { ICategory } from './category.interface';
import { generateCustomId } from '../../../utils/idGenerator';

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    subCategory: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

categorySchema.pre('save', async function (next) {
  if (this.isNew && !this.customId) {
    this.customId = await generateCustomId('CAT');
  }
  next();
});

export const Category = model<ICategory>('Category', categorySchema);
