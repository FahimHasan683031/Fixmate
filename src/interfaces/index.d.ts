import { JwtPayload } from 'jsonwebtoken';
import { Server } from 'socket.io';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
  var io: Server;
}
