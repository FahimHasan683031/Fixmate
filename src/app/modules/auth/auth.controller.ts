// Auth Controller
import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { AuthServices } from './auth.service';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import config from '../../../config';

// Controller for user login
const customLogin = catchAsync(async (req: Request, res: Response) => {
  const { ...loginData } = req.body;

  const result = await AuthServices.login(loginData);
  const { status, message, accessToken, refreshToken, userInfo } = result;
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      secure: config.node_env === 'production',
      httpOnly: true,
    });
  }

  sendResponse(res, {
    statusCode: status,
    success: true,
    message: message,
    data: { accessToken, refreshToken, userInfo },
  });
});

// Controller for admin login
const adminLogin = catchAsync(async (req: Request, res: Response) => {
  const { ...loginData } = req.body;

  const result = await AuthServices.adminLogin(loginData);
  const { status, message, accessToken, refreshToken, role } = result;

  sendResponse(res, {
    statusCode: status,
    success: true,
    message: message,
    data: { accessToken, refreshToken, role },
  });
});

// Controller to initiate forgot password flow
const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, phone } = req.body;
  const result = await AuthServices.forgetPassword(email.toLowerCase().trim(), phone);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `An OTP has been sent to your ${email || phone}. Please verify your email.`,
    data: result,
  });
});

// Controller to reset password with token
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const token = req.query.token as string;
  const { ...resetData } = req.body;

  const result = await AuthServices.resetPassword(token!, resetData);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password reset successfully, please login now.',
    data: result,
  });
});

// Controller to verify account via OTP
const verifyAccount = catchAsync(async (req: Request, res: Response) => {
  const { oneTimeCode, email } = req.body;

  const result = await AuthServices.verifyAccount(email, oneTimeCode);
  const { status, message, accessToken, refreshToken, token, userInfo } = result;
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      secure: config.node_env === 'production',
      httpOnly: true,
    });
  }

  sendResponse(res, {
    statusCode: status,
    success: true,
    message: message,
    data: { accessToken, refreshToken, token, userInfo },
  });
});

// Controller to get new access token
const getAccessToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const result = await AuthServices.getAccessToken(refreshToken);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
});

// Controller to resend verification OTP
const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, phone, authType } = req.body;
  await AuthServices.resendOtp(email, authType);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `An OTP has been sent to your ${email || phone}. Please verify your email.`,
  });
});

// Controller to change password for logged-in user
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const result = await AuthServices.changePassword(req.user!, currentPassword, newPassword);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password changed successfully',
    data: result,
  });
});

// Controller to register a new user
const createUser = catchAsync(async (req: Request, res: Response) => {
  const { ...userData } = req.body;
  const result = await AuthServices.createUser(userData);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User created successfully',
    data: result,
  });
});

// Controller to delete user account
const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { password } = req.body;
  const result = await AuthServices.deleteAccount(user!, password);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Account deleted successfully',
    data: result,
  });
});

// Controller to log out user and clear cookies
const logOut = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', {
    secure: config.node_env === 'production',
    httpOnly: true,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Logged out successfully',
  });
});

// Controller to refresh FCM token for notifications
const refreshFcmToken = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body;
  const result = await AuthServices.refreshFcmToken(req.user!, token);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'FCM token refreshed successfully',
    data: result,
  });
});

export const AuthController = {
  forgetPassword,
  resetPassword,
  verifyAccount,
  login: customLogin,
  getAccessToken,
  resendOtp,
  changePassword,
  createUser,
  deleteAccount,
  adminLogin,
  refreshFcmToken,
  logOut,
};
