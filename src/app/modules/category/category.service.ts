// Category Service
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { ICategory } from './category.interface';
import { Category } from './category.model';

// Create a new service category
const addNewCategory = async (category: ICategory) => {
  if (!category.image) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Category image is required');
  }
  return Category.create(category);
};

// Retrieve all active categories with pagination and search
const getCategories = async (query: Record<string, unknown>) => {
  const categoryQuery = Category.find({ isDeleted: false }).select('name image subCategory');

  const categoryQueryBuilder = new QueryBuilder(categoryQuery, query)
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await categoryQueryBuilder.modelQuery.lean().exec();
  const meta = await categoryQueryBuilder.getPaginationInfo();

  return { data, meta };
};

// Update an existing category's information
const updateCategory = async (id: string, category: ICategory) => {
  const result = await Category.findByIdAndUpdate(new Types.ObjectId(id), category, {
    new: true,
  })
    .lean()
    .exec();
  if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Category not found');
  return result;
};

// Soft-delete a category by setting isDeleted to true
const deleteCategory = async (id: string) => {
  const result = await Category.findByIdAndUpdate(
    new Types.ObjectId(id),
    { isDeleted: true },
    { new: true },
  )
    .lean()
    .exec();
  if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Category not found');
  return result;
};

export const CategoryService = {
  addNewCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
