import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { jwtHelper } from '../../helpers/jwtHelper';
import ApiError from '../../errors/ApiError';
import { User } from '../modules/user/user.model';
import { USER_STATUS } from '../../enum/user';

const auth =
  (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization;

      if (!tokenWithBearer) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Token not found!');
      }

      if (tokenWithBearer && tokenWithBearer.startsWith('Bearer')) {
        const token = tokenWithBearer.split(' ')[1];

        try {
          const verifyUser = jwtHelper.verifyToken(token, config.jwt.jwt_secret as Secret);

          req.user = verifyUser;

          if (roles.length && !roles.includes(verifyUser.role)) {
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              "You don't have permission to access this API",
            );
          }

          next();
        } catch (error) {
          if (error instanceof Error && error.name === 'TokenExpiredError') {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access Token has expired');
          }
          next(error);
        }
      }
    } catch (error) {
      next(error);
    }
  };

export default auth;

export const tempAuth =
  (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization;
      console.log('tempAuth tokenWithBearer', req.headers.authorization);
      if (!tokenWithBearer) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Token not found!');
      }

      if (tokenWithBearer && tokenWithBearer.startsWith('Bearer')) {
        const token = tokenWithBearer.split(' ')[1];

        console.log({ token });

        try {
          const verifyUser = jwtHelper.verifyToken(token, config.jwt.temp_jwt_secret as Secret);

          console.log({ verifyUser });

          req.user = verifyUser;

          const isExistUser = await User.findOne({email: verifyUser.email})

          if (!isExistUser) {
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              "You don't have permission to access this API",
            );
          }

          if(isExistUser.status !== USER_STATUS.ACTIVE){
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              "Your account is not active. Please contact the administrator.",
            );
          }

          if (roles.length && !roles.includes(verifyUser.role)) {
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              "You don't have permission to access this API",
            );
          }

          next();
        } catch (error) {
          if (error instanceof Error && error.name === 'TokenExpiredError') {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access Token has expired');
          }
          throw new ApiError(StatusCodes.FORBIDDEN, 'Invalid Access Token');
        }
      }
    } catch (error) {
      next(error);
    }
  };
