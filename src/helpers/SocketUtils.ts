import { Server } from "socket.io";
import { INotification } from "../app/modules/notification/notification.interface";
import { logger } from "../shared/logger";

export const sendNotification = async (
  io: Server,
  notification: INotification
) => {
  try {
    const userId = notification.for?.toString();
    if (!userId) throw new Error('Notification missing recipient userId');

    // Emit to the user's room (room name is the userId)
    io.to(userId).emit('notification', notification);
    logger.info(`Notification sent to room ${userId}`);

    return true;
  } catch (error: any) {
    logger.error(`Failed to send notification: ${error.message}`);
    return false;
  }
};
