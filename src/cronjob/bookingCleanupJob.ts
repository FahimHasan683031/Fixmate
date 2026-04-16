import cron from 'node-cron';
import { Booking } from '../app/modules/booking/booking.model';
import { BOOKING_STATUS } from '../enum/booking';
import { logger } from '../shared/logger';

export const bookingCleanupJob = () => {
  const CLEANUP_THRESHOLD_HOURS = 1;

  // Run every hour at the beginning of the hour
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoffDate = new Date(Date.now() - CLEANUP_THRESHOLD_HOURS * 60 * 60 * 1000);

      logger.info(`Booking Cleanup Job: Checking for stale 'CREATED' bookings older than ${CLEANUP_THRESHOLD_HOURS} hour(s).`);

      const result = await Booking.deleteMany({
        bookingStatus: BOOKING_STATUS.CREATED,
        createdAt: { $lt: cutoffDate },
      });

      if (result.deletedCount > 0) {
        logger.info(`Booking Cleanup Job: Successfully deleted ${result.deletedCount} stale bookings.`);
      }
    } catch (error) {
      logger.error('Error during Booking Cleanup Job:', error);
    }
  });

  logger.info(`Booking Cleanup Job scheduled to run every hour (Threshold: ${CLEANUP_THRESHOLD_HOURS} hour(s)).`);
};
