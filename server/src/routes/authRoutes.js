import express from 'express';
import {
    register,
    verifyOTP,
    login,
    refreshToken,
    logout,
    resendOTP,
    superAdminLogin
} from '../controllers/authController.js';
import {
    validate,
    registerSchema,
    verifyOTPSchema,
    loginSchema,
    resendOTPSchema
} from '../middleware/validate.js';
// Rate limiting disabled for MVP
import { optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new patient
 * @access  Public
 */
router.post(
    '/register',
    validate(registerSchema),
    register
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP for registration
 * @access  Public
 */
router.post(
    '/verify-otp',
    validate(verifyOTPSchema),
    verifyOTP
);

/**
 * @route   POST /api/auth/login
 * @desc    Login patient
 * @access  Public
 */
router.post(
    '/login',
    validate(loginSchema),
    login
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (requires refresh token cookie)
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout patient
 * @access  Public (optional auth)
 */
router.post('/logout', optionalAuthenticate, logout);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
router.post(
    '/resend-otp',
    validate(resendOTPSchema),
    resendOTP
);

/**
 * @route   POST /api/auth/super-admin/login
 * @desc    Login Super Admin
 * @access  Public
 */
router.post('/super-admin/login', superAdminLogin);

export default router;
