import cron from 'node-cron';
import { User } from '../app/modules/user/user.model';
import { logger } from '../shared/logger';

export const scheduleUnverifiedAccountCleanup = () => {
  const GRACE_PERIOD_MINUTES = 5;

  cron.schedule('* * * * *', async () => {
    try {
      const cutoffDate = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000);

      const result = await User.deleteMany({
        verified: false,
        createdAt: { $lt: cutoffDate },
      });

      logger.info(`Deleted ${result.deletedCount} unverified accounts.`);
    } catch (error) {
      logger.error('Error during unverified account cleanup:', error);
    }
  });
  logger.info('Unverified account cleanup job scheduled to run every minute.');
};
