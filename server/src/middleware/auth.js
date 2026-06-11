import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AuthError, ForbiddenError } from '../utils/errors.js';
import supabase from '../config/supabase.js';

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthError('No token provided or invalid format');
        }

        const token = authHeader.split(' ')[1];

        // Verify JWT signature + expiry
        let decoded;
        try {
            decoded = jwt.verify(token, config.jwt.accessSecret);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') throw new AuthError('Token expired');
            throw new AuthError('Invalid token');
        }

        // Fetch user + role name together
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, is_verified, is_active, role_id, hospital_id, roles(name)')
            .eq('id', decoded.userId || decoded.id)
            .single();

        if (error || !user) {
            throw new AuthError('User not found or token invalid');
        }

        if (!user.is_active) {
            throw new ForbiddenError('User account is deactivated');
        }

        const role = user.roles?.name;

        // Email verification is only required for patient/public registrations.
        // Hospital staff (doctors, nurses, etc.) are created directly by hospital admins
        // and must NOT be blocked by the is_verified flag.
        const STAFF_ROLES = ['DOCTOR','NURSE','HOSPITAL_ADMIN','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF','SUPER_ADMIN'];
        if (!STAFF_ROLES.includes(role) && !user.is_verified) {
            throw new ForbiddenError('User account is not verified');
        }

        // Attach enriched user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: role,
            roleId: user.role_id,
            hospitalId: user.hospital_id || null,
        };

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Role guard — call AFTER verifyToken
 * Supports any number of allowed roles: restrictTo('SUPER_ADMIN', 'PATIENT')
 */
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ForbiddenError('You do not have permission to perform this action'));
        }
        next();
    };
};
