import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────────────────
// MVP NOTE: Rate limiting is intentionally minimal for MVP.
// All limiters skip in development. Production limits are
// very generous. Re-evaluate before scaling to production.
// ─────────────────────────────────────────────────────────

const isDev = () => config.nodeEnv === 'development';

/** Auth limiter — only active in production */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isDev,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many attempts. Please wait 15 minutes and try again.'
        });
    }
});

/** OTP limiter — only active in production */
export const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isDev,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many OTP requests. Please wait 10 minutes and try again.'
        });
    }
});

/** General API limiter — very generous, skipped in dev */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isDev,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again shortly.'
        });
    }
});

/** Upload limiter — skipped in dev */
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isDev,
    message: {
        success: false,
        message: 'Too many upload requests. Please try again after an hour.'
    }
});
