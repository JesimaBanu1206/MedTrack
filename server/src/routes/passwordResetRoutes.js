/**
 * passwordResetRoutes.js
 * Email-based password reset (request + confirm)
 * Mounted at /api/auth — so endpoints are:
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 */

import express from 'express';
import { requestPasswordReset, resetPassword as confirmPasswordReset } from '../controllers/passwordResetController.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

const forgotSchema = Joi.object({
    email: Joi.string().email().required().trim().lowercase()
});

const resetSchema = Joi.object({
    token:           Joi.string().required(),
    newPassword:     Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'Passwords do not match' })
});

router.post('/forgot-password', validate(forgotSchema),  requestPasswordReset);
router.post('/reset-password',  validate(resetSchema),   confirmPasswordReset);

export default router;
