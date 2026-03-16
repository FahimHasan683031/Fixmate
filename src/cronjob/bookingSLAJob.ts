import cron from "node-cron";
import { Booking } from "../app/modules/booking/booking.model";
import { User } from "../app/modules/user/user.model";
import { BOOKING_STATUS } from "../enum/booking";
import { BookingStateMachine } from "../app/modules/booking/bookingStateMachine";
import { logger } from "../shared/logger";
import { refundPaystackTransaction } from "../helpers/paystackHelper";
import { Payment } from "../app/modules/payment/payment.model";
import { PAYMENT_STATUS } from "../enum/payment";
import { NotificationService } from "../app/modules/notification/notification.service";

export const bookingSLAJob = () => {
    const SLA_HOURS = 5;

    cron.schedule("*/15 * * * *", async () => { // Runs every 15 minutes
        try {
            const cutoffDate = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

            // Find Requested bookings that are older than SLA
            const expiredBookings = await Booking.find({
                bookingStatus: BOOKING_STATUS.REQUESTED,
                createdAt: { $lt: cutoffDate }
            }).populate("service").lean();

            for (const booking of expiredBookings) {
                try {
                    logger.info(`SLA Job: Expiring booking ${booking._id} due to no response within ${SLA_HOURS} hours.`);

                    // Transition state
                    await BookingStateMachine.transitionState(booking._id, "system", BOOKING_STATUS.EXPIRED, `Expired after ${SLA_HOURS} hours of inactivity`);

                    // Refund if paid
                    if (booking.isPaid && booking.transactionId) {
                        try {
                            await refundPaystackTransaction(booking.transactionId);
                            await Payment.findOneAndUpdate(
                                { booking: booking._id },
                                { paymentStatus: PAYMENT_STATUS.REFUNDED }
                            );
                        } catch (refundError) {
                            logger.error(`SLA Job: Failed to refund booking ${booking._id}:`, refundError);
                        }
                    }

                    // Notify customer
                    await NotificationService.insertNotification({
                        for: booking.customer,
                        message: `Your booking for ${(booking.service as any)?.subCategory || "service"} has expired as it was not accepted within ${SLA_HOURS} hours. A refund has been initiated.`,
                    });

                } catch (bookingError) {
                    logger.error(`SLA Job: Error processing booking ${booking._id}:`, bookingError);
                }
            }

            if (expiredBookings.length > 0) {
                logger.info(`SLA Job: Automatically expired ${expiredBookings.length} bookings.`);
            }

        } catch (error) {
            logger.error("Error during Booking SLA cleanup:", error);
        }
    });

    logger.info(`Booking SLA job scheduled to run every 15 minutes (Threshold: ${SLA_HOURS} hours).`);
};
