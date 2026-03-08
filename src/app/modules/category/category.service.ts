import QueryBuilder from "../../builder/QueryBuilder";
import { ICategory } from "./category.interface";
import { Category } from "./category.model";

// Create service
const createCategory = async (payload: ICategory) => {
  const result = await Category.create(payload);
  return result;
};

// Get all categories
const getAllCategories = async (query: Record<string, unknown>) => {
  const categoryQueryBuilder = new QueryBuilder(Category.find({ isActive: true, parent: null }), query)
    .filter()
    .fields()

  const totalCategories = await Category.countDocuments()

  const categories = await categoryQueryBuilder.modelQuery

  return {
    categories,
  };
};

// Update service
const updateCategory = async (id: string, payload: ICategory) => {
  const result = await Category.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return result;
};

// Delete service
const deleteCategory = async (id: string) => {
  const result = await Category.findByIdAndDelete(id);
  return result;
};


export const serviceService = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
