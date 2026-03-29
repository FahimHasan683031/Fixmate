// Auth Service
import { StatusCodes } from 'http-status-codes';
import { IAuthResponse, IResetPassword } from './auth.interface';
import { User } from '../user/user.model';
import ApiError from '../../../errors/ApiError';
import { USER_ROLES, USER_STATUS } from '../../../enum/user';
import { AuthHelper } from './auth.helper';
import { AuthCommonServices, authResponse } from './common';
import { ILoginData } from '../../../interfaces/auth';
import { emailTemplate } from '../../../shared/emailTemplate';
import { emailHelper } from '../../../helpers/emailHelper';
import { JwtPayload } from 'jsonwebtoken';
import { jwtHelper } from '../../../helpers/jwtHelper';
import config from '../../../config';
import bcrypt from 'bcrypt';
import cryptoToken, { generateOtp } from '../../../utils/crypto';
import { Token } from '../token/token.model';
import { IUser } from '../user/user.interface';
import mongoose from 'mongoose';

// Create a new user account with OTP verification
export const createUser = async (payload: IUser) => {
  payload.email = payload.email?.toLowerCase().trim();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (payload.role === USER_ROLES.ADMIN) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Admin account creation is not allowed.`);
    }

    const isUserExist = await User.findOne({
      email: payload.email,
      status: { $nin: [USER_STATUS.DELETED] },
    }).session(session);

    if (isUserExist) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `An account with this email already exists.`);
    }

    const otp = generateOtp();
    const otpExpiresIn = new Date(Date.now() + 5 * 60 * 1000);

    const authentication = {
      oneTimeCode: otp,
      expiresAt: otpExpiresIn,
      latestRequestAt: new Date(),
      requestCount: 1,
      authType: 'createAccount' as const,
      restrictionLeftAt: null,
      resetPassword: false,
      wrongLoginAttempts: 0,
    };

    const userData: any = {
      ...payload,
      password: payload.password,
      authentication,
      role: payload.role || USER_ROLES.CLIENT,
    };

    // Ensure providerDetails is only present for PROVIDER role
    if (userData.role !== USER_ROLES.PROVIDER) {
      delete userData.providerDetails;
    } else if (!userData.providerDetails) {
      // Initialize empty providerDetails for providers if needed, 
      // or let it be undefined if preferred. Given the requirement, 
      // we can just leave it to be filled later or init with empty object.
      userData.providerDetails = {};
    }

    const user = await User.create([userData], { session });

    if (!user[0]) throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user.');

    const createdUser = user[0];

    setTimeout(() => {
      const createAccountEmail = emailTemplate.createAccount({
        name: payload.name,
        email: payload.email,
        otp,
      });
      emailHelper.sendEmail(createAccountEmail);
    }, 0);

    await session.commitTransaction();
    return createdUser._id;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Authenticate a user and return tokens
const login = async (payload: ILoginData): Promise<IAuthResponse> => {
  const { email, phone } = payload;
  const query = email ? { email: email.toLowerCase().trim() } : { phone: phone };

  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE] },
  })
    .select('+password +authentication')
    .lean();

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}`,
    );
  }

  const result = await AuthCommonServices.handleLoginLogic(payload, isUserExist);
  return result;
};

// Authenticate an admin user and return tokens
const adminLogin = async (payload: ILoginData): Promise<IAuthResponse> => {
  const { email, phone } = payload;
  const query = email ? { email: email.trim().toLowerCase() } : { phone: phone };

  const isUserExist = await User.findOne({
    ...query,
  })
    .select('+password +authentication')
    .lean();

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}`,
    );
  }

  if (isUserExist.role !== USER_ROLES.ADMIN) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You are not authorized to login as admin');
  }

  const isPasswordMatch = await AuthHelper.isPasswordMatched(
    payload.password,
    isUserExist.password as string,
  );

  if (!isPasswordMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Please try again with correct credentials.');
  }

  const tokens = AuthHelper.createToken(
    isUserExist._id,
    isUserExist.role,
    isUserExist.name,
    isUserExist.email,
  );

  return authResponse(
    StatusCodes.OK,
    `Welcome back ${isUserExist.name}`,
    isUserExist.role,
    tokens.accessToken,
    tokens.refreshToken,
  );
};

// Handle forgot password request and send OTP
const forgetPassword = async (email?: string, phone?: string) => {
  const query = email ? { email: email.toLocaleLowerCase().trim() } : { phone: phone };
  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE] },
  });

  if (!isUserExist) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No account found with this email or phone');
  }

  const otp = generateOtp();

  const authentication = {
    resetPassword: true,
    oneTimeCode: otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    latestRequestAt: new Date(),
    requestCount: 1,
    authType: 'resetPassword' as const,
    restrictionLeftAt: null,
    wrongLoginAttempts: 0,
  };

  await User.findByIdAndUpdate(
    isUserExist._id,
    {
      $set: { authentication: authentication },
    },
    { new: true },
  );

  if (email) {
    const forgetPasswordEmailTemplate = emailTemplate.resetPassword({
      name: isUserExist.name,
      email: isUserExist.email,
      otp,
    });

    setTimeout(() => {
      emailHelper.sendEmail(forgetPasswordEmailTemplate);
    }, 0);
  }

  return 'OTP sent successfully.';
};

// Reset user password using a verified token
const resetPassword = async (resetToken: string, payload: IResetPassword) => {
  const { newPassword, confirmPassword } = payload;
  if (newPassword !== confirmPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Passwords do not match');
  }

  const isTokenExist = await Token.isExistToken(resetToken);

  if (!isTokenExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You don't have authorization to reset your password, please verify your account first.",
    );
  }

  const isUserExist = await User.findById(isTokenExist.user).select('+authentication').lean();
  console.log(isUserExist);

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Requested user not found, please try again or contact support.',
    );
  }

  const { authentication } = isUserExist;
  if (!authentication?.resetPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You don\'t have permission to change the password. Please click again to "Forgot Password"',
    );
  }

  const isTokenValid = await Token.isExpireToken(resetToken);
  if (!isTokenValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Your reset token has expired, please try again.');
  }

  const hashPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));

  const updatedUserData = {
    password: hashPassword,
    authentication: {
      resetPassword: false,
      oneTimeCode: '',
      expiresAt: null,
      latestRequestAt: new Date(),
      requestCount: 0,
      restrictionLeftAt: null,
      wrongLoginAttempts: 0,
    },
  };

  await User.findByIdAndUpdate(isUserExist._id, { $set: updatedUserData }, { new: true });

  return { message: 'Password reset successfully' };
};

// Verify user account or reset code using OTP
const verifyAccount = async (email: string, onetimeCode: string): Promise<IAuthResponse> => {
  if (!onetimeCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP is required.');
  }
  const isUserExist = await User.findOne({
    email: email.toLowerCase().trim(),
    status: { $nin: [USER_STATUS.DELETED] },
  })
    .select('+password +authentication')
    .lean();

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email}, please register first.`,
    );
  }

  const { authentication } = isUserExist;

  if (authentication?.oneTimeCode !== onetimeCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid OTP, please try again.');
  }

  const currentDate = new Date();
  if (authentication?.expiresAt! < currentDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP has expired, please try again.');
  }

  if (!isUserExist.verified) {
    await User.findByIdAndUpdate(isUserExist._id, { $set: { verified: true } }, { new: true });

    const tokens = AuthHelper.createToken(
      isUserExist._id,
      isUserExist.role,
      isUserExist.name,
      isUserExist.email,
    );
    const userInfo = {
      id: isUserExist._id,
      role: isUserExist.role,
      name: isUserExist.name,
      email: isUserExist.email!,
      image: isUserExist.image!,
    };

    return authResponse(
      StatusCodes.OK,
      `Welcome ${isUserExist.name} to our platform.`,
      undefined,
      tokens.accessToken,
      tokens.refreshToken,
      undefined,
      userInfo,
    );
  } else {
    await User.findByIdAndUpdate(
      isUserExist._id,
      {
        $set: {
          authentication: {
            oneTimeCode: '',
            expiresAt: null,
            latestRequestAt: null,
            requestCount: 0,
            authType: '',
            resetPassword: true,
          },
        },
      },
      { new: true },
    );

    const token = await Token.create({
      token: cryptoToken(),
      user: isUserExist._id,
      expireAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    console.log(token.token);

    if (!token) {
      throw new ApiError(StatusCodes.BAD_REQUEST, ' please try again. or contact support.');
    }

    return authResponse(
      StatusCodes.OK,
      'OTP verified successfully, please reset your password.',
      undefined,
      undefined,
      undefined,
      token.token,
    );
  }
};

// Generate a new access token using a refresh token
const getAccessToken = async (token: string) => {
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh Token is required');
  }

  try {
    const decodedToken = jwtHelper.verifyToken(token, config.jwt.jwt_refresh_secret as string);

    const { userId, role } = decodedToken;

    const tokens = AuthHelper.createToken(userId, role, decodedToken.name, decodedToken.email);

    return {
      accessToken: tokens.accessToken,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh Token has expired');
    }
    throw new ApiError(StatusCodes.FORBIDDEN, 'Invalid Refresh Token');
  }
};

// Resend OTP to a user's phone or email
const resendOtpToPhoneOrEmail = async (
  authType: 'resetPassword' | 'createAccount',
  email?: string,
  phone?: string,
) => {
  const query = email ? { email: email } : { phone: phone };
  const isUserExist = await User.findOne({
    ...query,
    status: { $in: [USER_STATUS.ACTIVE] },
  }).select('+authentication');

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email ? 'email' : 'phone'}`,
    );
  }

  const { authentication } = isUserExist;
  if (authentication?.requestCount! >= 5) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have exceeded the maximum number of requests. Please try again later.',
    );
  }

  const otp = generateOtp();
  const updatedAuthentication = {
    ...authentication,
    oneTimeCode: otp,
    latestRequestAt: new Date(),
    requestCount: authentication?.requestCount! + 1,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    authType: authType,
  };

  if (email) {
    const forgetPasswordEmailTemplate = emailTemplate.resendOtp({
      email: isUserExist.email,
      name: isUserExist.name,
      otp,
      type: authType,
    });

    await User.findByIdAndUpdate(
      isUserExist._id,
      {
        $set: { authentication: updatedAuthentication },
      },
      { new: true },
    );

    await emailHelper.sendEmail(forgetPasswordEmailTemplate);
  }

  if (phone) {
    await User.findByIdAndUpdate(
      isUserExist._id,
      {
        $set: { authentication: updatedAuthentication },
      },
      { new: true },
    );
  }
};

// Soft-delete a user account after password verification
const deleteAccount = async (user: JwtPayload, password: string) => {
  const { authId } = user;
  const isUserExist = await User.findById(authId).select('+password');

  if (!isUserExist) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete account. Please try again.');
  }

  if (isUserExist.status === USER_STATUS.DELETED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Requested user is already deleted.');
  }

  const isPasswordMatched = await bcrypt.compare(password, isUserExist.password);

  if (!isPasswordMatched) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Please provide a valid password to delete your account.',
    );
  }

  const deletedData = await User.findByIdAndUpdate(authId, {
    $set: { status: USER_STATUS.DELETED },
  });

  return {
    status: StatusCodes.OK,
    message: 'Account deleted successfully.',
    deletedData,
  };
};

// Resend OTP for either account creation or password reset
const resendOtp = async (email: string, authType: 'createAccount' | 'resetPassword') => {
  const isUserExist = await User.findOne({
    email: email.toLowerCase().trim(),
    status: { $in: [USER_STATUS.ACTIVE] },
  }).select('+authentication');

  if (!isUserExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `No account found with this ${email}, please try again.`,
    );
  }

  const { authentication } = isUserExist;

  const otp = generateOtp();
  const authenticationPayload = {
    ...authentication,
    oneTimeCode: otp,
    latestRequestAt: new Date(),
    requestCount: authentication?.requestCount! + 1,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };

  if (authenticationPayload.requestCount! >= 5) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You have exceeded the maximum number of requests. Please try again later.',
    );
  }

  await User.findByIdAndUpdate(
    isUserExist._id,
    {
      $set: { authentication: authenticationPayload },
    },
    { new: true },
  );

  if (email) {
    const forgetPasswordEmailTemplate = emailTemplate.resendOtp({
      email: email,
      name: isUserExist.name,
      otp,
      type: authType,
    });

    setTimeout(() => {
      emailHelper.sendEmail(forgetPasswordEmailTemplate);
    }, 0);
  }

  return 'OTP sent successfully.';
};

// Change user password for an authenticated user
const changePassword = async (user: JwtPayload, currentPassword: string, newPassword: string) => {
  const isUserExist = await User.findById(user.authId).select('+password').lean();

  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const isPasswordMatch = await AuthHelper.isPasswordMatched(
    currentPassword,
    isUserExist.password as string,
  );

  if (!isPasswordMatch) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));

  await User.findByIdAndUpdate(user.authId, { password: hashedPassword }, { new: true });

  return { message: 'Password changed successfully' };
};

// Update the FCM token for push notifications
const refreshFcmToken = async (user: JwtPayload, token: string) => {
  const result = await User.findByIdAndUpdate(
    user.id || user.authId,
    { fcmToken: token },
    { new: true },
  );
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found!');
  }
};

export const AuthServices = {
  forgetPassword,
  resetPassword,
  verifyAccount,
  login,
  getAccessToken,
  resendOtpToPhoneOrEmail,
  deleteAccount,
  resendOtp,
  changePassword,
  createUser,
  adminLogin,
  refreshFcmToken,
};
