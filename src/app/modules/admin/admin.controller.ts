import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AdminServices } from "./admin.service";
import { getSingleFilePath } from "../../../shared/getFilePath";
import { PDFMultiInvoiceMaker } from "../../../helpers/pdfMaker";

const overview = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.overview(req.query.year as string);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Admin overview retrieved successfully",
        data: result,
    });
});


const getUsers = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getUsers(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Users retrieved successfully",
        data: result,
    });
});

const getUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getUser(req.params.id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "User retrieved successfully",
        data: result,
    });
});

const addNewCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.addNewCategory(req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Category added successfully",
        data: result,
    });
});

const getCategories = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getCategories(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Categories retrieved successfully",
        data: result,
    });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.updateCategory(req.body.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Category updated successfully",
        data: result,
    });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.deleteCategory(req.params.id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Category deleted successfully",
        data: result,
    });
});

const getPolicy = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getPolicy();

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Policy retrieved successfully",
        data: result,
    });
});

const updatePolicy = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.upsertPolicy(req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Policy updated successfully",
        data: result,
    });
});

const getTerms = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getTerms();

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Terms retrieved successfully",
        data: result,
    });
});

const updateTerms = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.upsertTerms(req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Terms updated successfully",
        data: result,
    });
});

const blockAndUnblockUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.blockAndUnblockUser(req.params.id, req.params.status as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: `User ${req.params.status}ed successfully`,
        data: result,
    });
});

const getRequests = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.getRequests(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Requests retrieved successfully",
        data: result,
    });
});

const approveOrReject = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.approveOrReject(req.params.id, req.params.status as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: `Request ${req.params.status}ed successfully`,
        data: result,
    });
});

const find = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.find(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Find successful",
        data: result,
    });
});

const getBookings = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminServices.bookingData(req.query as any);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Successfully get all Bookings!",
        data: result,
    });
});

const generateMultiInvoices = catchAsync(async (req: Request, res: Response) => {
    const orders = await AdminServices.generateMultiInvoices(req.body);

    const pdfMaker = new PDFMultiInvoiceMaker();
    pdfMaker.streamMultiPDFToResponse(res, orders, "combined-invoices.pdf");
});

export const AdminController = {
    getUsers,
    getUser,
    addNewCategory,
    getCategories,
    updateCategory,
    deleteCategory,
    getPolicy,
    updatePolicy,
    getTerms,
    updateTerms,
    blockAndUnblockUser,
    getRequests,
    approveOrReject,
    overview,
    find,
    getBookings,
    generateMultiInvoices,
};
