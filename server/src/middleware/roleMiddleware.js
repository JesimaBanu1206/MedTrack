import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';

/**
 * Role-based access control middleware
 * Checks if user has required role(s)
 */
export function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.roleId) {
                throw new AppError('Authentication required', 401);
            }

            // Get user's role name
            const { data: role, error: roleError } = await supabase
                .from('roles')
                .select('name')
                .eq('id', req.user.roleId)
                .single();

            if (roleError || !role) {
                throw new AppError('Invalid role', 403);
            }

            const normalizedUserRole = String(role.name || '').trim().toUpperCase();
            const normalizedAllowedRoles = allowedRoles.map((r) => String(r || '').trim().toUpperCase());

            // Check if user's role is in allowed roles
            if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
                await createAuditLog({
                    userId: req.user.id,
                    action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: {
                        requiredRoles: allowedRoles,
                        userRole: normalizedUserRole || role.name,
                        path: req.path
                    },
                    status: 'FAILURE',
                    errorMessage: 'Insufficient permissions'
                });

                throw new AppError(
                    `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
                    403
                );
            }

            // Attach role name to request for convenience
            req.user.roleName = role.name;

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Patient-only access middleware
 * Shorthand for requireRole('PATIENT')
 */
export const requirePatient = requireRole('PATIENT');

/**
 * Doctor-only access middleware
 */
export const requireDoctor = requireRole('DOCTOR');

/**
 * Admin access middleware
 */
export const requireAdmin = requireRole('HOSPITAL_ADMIN', 'DISTRICT_ADMIN', 'SUPER_ADMIN');

/**
 * Healthcare staff access middleware
 */
export const requireStaff = requireRole('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN');
