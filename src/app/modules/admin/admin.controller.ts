// Admin Controller
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AdminServices } from './admin.service';
import { PDFMultiInvoiceMaker } from '../../../helpers/pdfMaker';
import { CategoryController } from '../category/category.controller';
import { BookingController } from '../booking/booking.controller';
import { VerificationController } from '../verification/verification.controller';
import { TermsAndPolicyController } from '../terms&policy/terms&policy.controller';

// Controller for platform overview stats
const overview = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminServices.overview(req.query.year as string);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin overview retrieved successfully',
    data: result,
  });
});

const addNewCategory = CategoryController.addNewCategory;
const getCategories = CategoryController.getCategories;
const updateCategory = CategoryController.updateCategory;
const deleteCategory = CategoryController.deleteCategory;

const getPolicy = TermsAndPolicyController.getPolicy;
const upsertPolicy = TermsAndPolicyController.upsertPolicy;
const getTerms = TermsAndPolicyController.getTerms;
const upsertTerms = TermsAndPolicyController.upsertTerms;

const getRequests = VerificationController.getAllRequests;
const approveOrReject = VerificationController.updateStatus;

// Controller for generic find functionality
const find = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminServices.find(req.query as any);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Find successful',
    data: result,
  });
});

const getBookings = BookingController.getBookings;

// Controller to generate and stream multiple invoices as PDF
const generateMultiInvoices = catchAsync(async (req: Request, res: Response) => {
  const payments: any[] = await AdminServices.generateMultiInvoices(req.body);

  const orders = payments.map(data => ({
    service: {
      price: data.service?.price || 0,
      category: data.service?.category || 'N/A',
      subCategory: data.service?.subCategory || 'N/A',
    },
    customer: {
      name: data.customer?.name || 'N/A',
      address: data.customer?.address || 'N/A',
      email: data.customer?.email || 'N/A',
    },
    amount: data.amount || 0,
    platformFee: data.platformFee || 0,
    gatewayFee: data.gatewayFee || 0,
    providerAmount: data.providerAmount || data.amount - (data.platformFee || 0),
    paymentStatus: data.paymentStatus || 'PENDING',
    createdAt: data.createdAt || new Date(),
    id: data._id?.toString() || `inv-${Date.now()}`,
  }));

  const pdfMaker = new PDFMultiInvoiceMaker();
  await pdfMaker.streamMultiPDFToResponse(res, orders as any, 'combined-invoices.pdf');
});

// Controller to fetch exact profit breakdowns
const getRevenueTracking = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminServices.getRevenueTracking();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Revenue tracking statistics retrieved successfully',
    data: result,
  });
});

export const AdminController = {
  addNewCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  getPolicy,
  upsertPolicy,
  getTerms,
  upsertTerms,
  getRequests,
  approveOrReject,
  overview,
  find,
  getBookings,
  generateMultiInvoices,
  getRevenueTracking,
};
