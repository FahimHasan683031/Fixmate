import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import ApiError from "../../../errors/ApiError";
import QueryBuilder from "../../builder/QueryBuilder";
import { IBooking } from "./booking.interface";
import { Booking } from "./booking.model";
import { BOOKING_STATUS } from "../../../enum/booking";
import { Notification } from "../notification/notification.model";
import { User } from "../user/user.model";
import { Service } from "../service/service.model";
import { USER_ROLES } from "../../../enum/user";

const createBooking = async (payload: JwtPayload, data: Partial<IBooking>) => {
    const service = await Service.findById(data.service);
    if (!service) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Service not found!");
    }

    const bookingData = {
        ...data,
        customer: payload.authId,
        provider: service.creator,
        bookingStatus: BOOKING_STATUS.PENDING,
        isPaid: false,
    };

    const result = await Booking.create(bookingData);

    await Notification.create({
        receiver: service.creator,
        title: "New Booking Request",
        message: `You have a new booking request for ${service.category}`,
        referenceId: result._id,
        model_type: "Booking",
    });

    return result;
};

const getMyBookings = async (payload: JwtPayload, query: Record<string, unknown>) => {
    const filter: any = {
        isDeleted: { $ne: true },
    };

    if (payload.role === USER_ROLES.CLIENT) {
        filter.customer = payload.authId;
    } else if (payload.role === USER_ROLES.PROVIDER) {
        filter.provider = payload.authId;
        filter.isPaid = true; // Providers only see paid bookings in their list usually
    }

    const bookingQuery = Booking.find(filter)
        .populate({
            path: "customer",
            select: "name image address contact whatsApp",
        })
        .populate({
            path: "provider",
            select: "name image address contact whatsApp",
        })
        .populate({
            path: "service",
            select: "image price category subCategory",
        });

    const bookingQueryBuilder = new QueryBuilder(bookingQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const data = await bookingQueryBuilder.modelQuery.lean().exec();
    const meta = await bookingQueryBuilder.getPaginationInfo();

    return { data, meta };
};

const getSingleBooking = async (payload: JwtPayload, id: string) => {
    const booking = await Booking.findById(id)
        .populate({
            path: "customer",
            select: "name image address contact whatsApp nationality",
        })
        .populate({
            path: "provider",
            select: "name image address contact whatsApp category experience nationality",
        })
        .populate({
            path: "service",
            select: "image price category subCategory expertise",
        });

    if (!booking) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");
    }

    // Authorization check
    if (
        payload.role !== USER_ROLES.ADMIN &&
        booking.customer.toString() !== payload.authId &&
        booking.provider.toString() !== payload.authId
    ) {
        throw new ApiError(StatusCodes.FORBIDDEN, "You are not authorized to view this booking");
    }

    return booking;
};

const updateBookingStatus = async (
    payload: JwtPayload,
    id: string,
    status: BOOKING_STATUS,
    reason?: string
) => {
    const booking = await Booking.findById(id);
    if (!booking) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found!");
    }

    // Role-based status updates
    if (payload.role === USER_ROLES.PROVIDER) {
        if (booking.provider.toString() !== payload.authId) {
            throw new ApiError(StatusCodes.FORBIDDEN, "Unauthorized");
        }

        if (status === BOOKING_STATUS.ACCEPTED || status === BOOKING_STATUS.REJECTED) {
            if (booking.bookingStatus !== BOOKING_STATUS.PENDING) {
                throw new ApiError(StatusCodes.BAD_REQUEST, "Booking already interacted!");
            }
            booking.bookingStatus = status;
            if (status === BOOKING_STATUS.REJECTED) {
                booking.rejectReason = reason || "No reason provided";
            }
        } else if (status === BOOKING_STATUS.COMPLETED) {
            if (booking.bookingStatus !== BOOKING_STATUS.ACCEPTED) {
                throw new ApiError(StatusCodes.BAD_REQUEST, "You must accept the booking first!");
            }
            booking.bookingStatus = status;
        } else {
            throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid status update for provider");
        }
    } else if (payload.role === USER_ROLES.CLIENT) {
        if (booking.customer.toString() !== payload.authId) {
            throw new ApiError(StatusCodes.FORBIDDEN, "Unauthorized");
        }

        if (status === BOOKING_STATUS.CANCELLED) {
            if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED].includes(booking.bookingStatus)) {
                throw new ApiError(StatusCodes.BAD_REQUEST, `Booking already ${booking.bookingStatus.toLowerCase()}`);
            }
            booking.bookingStatus = status;
        } else {
            throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid status update for client");
        }
    }

    await booking.save();

    // Notify the other party
    const receiver = payload.role === USER_ROLES.CLIENT ? booking.provider : booking.customer;
    await Notification.create({
        receiver,
        title: `Booking ${status}`,
        message: `Your booking has been ${status.toLowerCase()}`,
        referenceId: booking._id,
        model_type: "Booking",
    });

    return booking;
};

export const BookingServices = {
    createBooking,
    getMyBookings,
    getSingleBooking,
    updateBookingStatus,
};
