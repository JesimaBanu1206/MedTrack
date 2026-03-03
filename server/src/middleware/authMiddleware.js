import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';

/**
 * Authentication Middleware
 * Verifies JWT access token and attaches user to request
 */
export async function authenticate(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No token provided. Authorization header required.', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, config.jwt.accessSecret);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AppError('Token expired. Please refresh your token.', 401);
            } else if (error.name === 'JsonWebTokenError') {
                throw new AppError('Invalid token.', 401);
            } else {
                throw error;
            }
        }

        // Verify user still exists and is active
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, role_id, is_active, is_verified')
            .eq('id', decoded.userId)
            .single();

        if (userError || !user) {
            await createAuditLog({
                userId: decoded.userId,
                action: AUDIT_ACTIONS.INVALID_TOKEN,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { reason: 'User not found' },
                status: 'FAILURE',
                errorMessage: 'User not found'
            });
            throw new AppError('User not found.', 401);
        }

        if (!user.is_active) {
            await createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { reason: 'Account deactivated' },
                status: 'FAILURE',
                errorMessage: 'Account deactivated'
            });
            throw new AppError('Account is deactivated.', 403);
        }

        if (!user.is_verified) {
            throw new AppError('Account not verified.', 403);
        }

        // Attach user to request
        req.user = {
            id: user.id,
            roleId: user.role_id,
            patientId: decoded.patientId
        };

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is valid, but doesn't fail if no token
 */
export async function optionalAuthenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);

        const decoded = jwt.verify(token, config.jwt.accessSecret);

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, role_id, is_active, is_verified')
            .eq('id', decoded.userId)
            .single();

        if (!userError && user && user.is_active && user.is_verified) {
            req.user = {
                id: user.id,
                roleId: user.role_id,
                patientId: decoded.patientId
            };
        }

        next();
    } catch (error) {
        // Silently fail for optional auth
        next();
    }
}
