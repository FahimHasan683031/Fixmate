import colors from 'colors';
import { Server } from 'socket.io';
import { logger } from '../shared/logger';

const socket = (io: Server) => {
  io.on('connection', socket => {
    logger.info(colors.blue('A user connected'));

    const userId = socket.handshake.query.userId as string;
    if (userId) {
      socket.join(userId);
      logger.info(colors.green(`User ${userId} joined room ${userId}`));
    }

    socket.on('disconnect', () => {
      logger.info(colors.red('A user disconnect'));
    });
  });
};

export const socketHelper = { socket };
