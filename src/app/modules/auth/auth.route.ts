import express from 'express'
import { AuthController } from './auth.controller'
import validateRequest from '../../middleware/validateRequest'
import { AuthValidations } from './auth.validation'
import { USER_ROLES } from '../../../enum/user'
import auth, { tempAuth } from '../../middleware/auth'
// import { UserValidations } from '../user/user.validation'
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody'

const router = express.Router()

router.post(
  '/signup',
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(AuthValidations.createUserZodSchema),
  AuthController.createUser,
)
router.post(
  '/admin-login',
  validateRequest(AuthValidations.loginZodSchema),
  AuthController.adminLogin,
)
router.post(
  '/login',
  validateRequest(AuthValidations.loginZodSchema),
  AuthController.login,
)



router.post(
  '/verify-account',
  validateRequest(AuthValidations.verifyAccountZodSchema),
  AuthController.verifyAccount,
)

router.post(
  '/forget-password',
  validateRequest(AuthValidations.forgetPasswordZodSchema),
  AuthController.forgetPassword,
)
router.post(
  '/reset-password',
  validateRequest(AuthValidations.resetPasswordZodSchema),
  AuthController.resetPassword,
)

router.post(
  '/resend-otp',

  validateRequest(AuthValidations.resendOtpZodSchema),
  AuthController.resendOtp,
)

router.post(
  '/change-password',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  validateRequest(AuthValidations.changePasswordZodSchema),
  AuthController.changePassword,
)

router.delete(
  '/delete-account',
  auth(USER_ROLES.ADMIN, USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  validateRequest(AuthValidations.deleteAccount),
  AuthController.deleteAccount,
)

router.post('/access-token', AuthController.getAccessToken)
router.patch(
  '/refresh-fcm-token',
  auth(USER_ROLES.CLIENT, USER_ROLES.PROVIDER),
  AuthController.refreshFcmToken
)

router.post('/logout', AuthController.logOut)

export const AuthRoutes = router
