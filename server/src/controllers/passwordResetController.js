/**
 * passwordResetController.js
 * Email-based password reset flow
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../utils/errors.js';
import { sendPasswordResetEmail } from '../config/mailer.js';

const RESET_TOKEN_EXPIRY_MINUTES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PASSWORD RESET
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
export async function requestPasswordReset(req, res, next) {
    const { email } = req.body;
    try {
        // Always respond with 200 to prevent email enumeration
        const { data: user } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (user) {
            // Invalidate old tokens
            await supabase
                .from('password_reset_tokens')
                .update({ used_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .is('used_at', null);

            // Generate secure token
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

            await supabase.from('password_reset_tokens').insert({
                user_id: user.id,
                token,
                expires_at: expiresAt
            });

            await sendPasswordResetEmail({
                to: user.email,
                name: user.full_name || 'User',
                token,
                expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES
            });
        }

        res.status(200).json({
            success: true,
            message: 'If that email exists, a reset link has been sent.'
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export async function resetPassword(req, res, next) {
    const { token, newPassword } = req.body;
    try {
        const { data: resetRecord, error } = await supabase
            .from('password_reset_tokens')
            .select('id, user_id, expires_at, used_at')
            .eq('token', token)
            .single();

        if (error || !resetRecord) throw new AppError('Invalid or expired reset token', 400);
        if (resetRecord.used_at)  throw new AppError('Reset token already used', 400);
        if (new Date(resetRecord.expires_at) < new Date()) throw new AppError('Reset token expired', 400);

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await supabase
            .from('users')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('id', resetRecord.user_id);

        // Mark token as used
        await supabase
            .from('password_reset_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', resetRecord.id);

        res.status(200).json({ success: true, message: 'Password reset successfully. Please login.' });
    } catch (error) {
        next(error);
    }
}
