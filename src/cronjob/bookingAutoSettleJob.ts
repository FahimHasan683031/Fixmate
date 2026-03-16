import cron from "node-cron";
import { Booking } from "../app/modules/booking/booking.model";
import { User } from "../app/modules/user/user.model";
import { BOOKING_STATUS } from "../enum/booking";
import { BookingStateMachine } from "../app/modules/booking/bookingStateMachine";
import { logger } from "../shared/logger";
import { Payment } from "../app/modules/payment/payment.model";
import { PAYMENT_STATUS } from "../enum/payment";
import { NotificationService } from "../app/modules/notification/notification.service";
import { Types } from "mongoose";
import { IUser } from "../app/modules/user/user.interface";

export const bookingAutoSettleJob = () => {
    const SETTLE_THRESHOLD_HOURS = 48;

    cron.schedule("0 * * * *", async () => { // Runs every hour
        try {
            const cutoffDate = new Date(Date.now() - SETTLE_THRESHOLD_HOURS * 60 * 60 * 1000);

            // Find bookings marked COMPLETED_BY_PROVIDER that are older than 48 hours
            // We use updatedAt to ensure we give 48 hours since the provider clicked 'complete'
            const pendingSettlements = await Booking.find({
                bookingStatus: BOOKING_STATUS.COMPLETED_BY_PROVIDER,
                updatedAt: { $lt: cutoffDate }
            }).populate("service").lean();

            for (const booking of pendingSettlements) {
                try {
                    logger.info(`Auto-Settle Job: Settling booking ${booking._id} after ${SETTLE_THRESHOLD_HOURS} hours of inactivity.`);

                    const payment = await Payment.findOne({ booking: booking._id }).lean();
                    if (!payment) {
                        logger.error(`Auto-Settle Job: Payment record not found for booking ${booking._id}`);
                        continue;
                    }

                    // 1. Transition state to CONFIRMED_BY_CLIENT then AUTO_SETTLED
                    // Note: CONFIRMED_BY_CLIENT is needed for strict progression in State Machine
                    await BookingStateMachine.transitionState(booking._id, "system", BOOKING_STATUS.CONFIRMED_BY_CLIENT);
                    await BookingStateMachine.transitionState(booking._id, "system", BOOKING_STATUS.AUTO_SETTLED);

                    // 2. Update Payment status
                    await Payment.findByIdAndUpdate(payment._id, { paymentStatus: PAYMENT_STATUS.AUTO_SETTLED });

                    // 3. Release payment to provider wallet
                    const provider = await User.findById(booking.provider).select("wallet").lean() as IUser;
                    if (provider) {
                        await User.findByIdAndUpdate(booking.provider, { 
                            wallet: (provider.wallet || 0) + (payment.providerAmount || 0) 
                        });
                    }

                    // 4. Notify provider
                    await NotificationService.insertNotification({
                        for: booking.provider,
                        message: `Your booking for ${(booking.service as any)?.subCategory || "service"} has been automatically settled as the client took no action within ${SETTLE_THRESHOLD_HOURS} hours. Payment is now in your wallet.`,
                    });

                } catch (bookingError) {
                    logger.error(`Auto-Settle Job: Error processing booking ${booking._id}:`, bookingError);
                }
            }

            if (pendingSettlements.length > 0) {
                logger.info(`Auto-Settle Job: Automatically settled ${pendingSettlements.length} bookings.`);
            }

        } catch (error) {
            logger.error("Error during Booking Auto-Settle cleanup:", error);
        }
    });

    logger.info(`Booking Auto-Settle job scheduled to run every hour (Threshold: ${SETTLE_THRESHOLD_HOURS} hours).`);
};
