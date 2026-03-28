// Category Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { CategoryService } from './category.service';

// Controller to create a new category
const addNewCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.addNewCategory(req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category added successfully',
    data: result,
  });
});

// Controller to get a list of all categories
const getCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.getCategories(req.query as any);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Categories retrieved successfully',
    data: result,
  });
});

// Controller to update category details
const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.updateCategory(req.body.id, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category updated successfully',
    data: result,
  });
});

// Controller to delete a specific category
const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.deleteCategory(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category deleted successfully',
    data: result,
  });
});

export const CategoryController = {
  addNewCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
