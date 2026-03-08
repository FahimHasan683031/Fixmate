import { Server } from "socket.io";
import { INotification } from "../app/modules/notification/notification.interface";
import { redisDB } from "../redis/connectedUsers";
import { logger } from "../shared/logger";

export const sendNotification = async (
  io: Server,
  notification: INotification
) => {
  try {
    const userId = notification.receiver;
    if (!userId) throw new Error('Notification missing recipient userId');

    // const socketId = await redisDB.get(`user:${userId}`);
    // if (!socketId) {
    //   logger.warn(`User ${userId} is offline. Notification skipped.`);
    //   return false;
    // }

    // io.to(socketId).emit('notification', notification);
    io.emit(`notification::${userId}`, notification);
    // logger.info(`Notification sent to user ${userId} , socketId: ${socketId}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to send notification: ${error.message}`);
    return false;
  }
};