import supabase from '../config/supabase.js';

/**
 * Create audit log entry
 * @param {Object} logData - Audit log data
 * @param {string} logData.userId - User ID
 * @param {string} logData.action - Action performed
 * @param {string} logData.entityType - Type of entity
 * @param {string} logData.entityId - Entity ID
 * @param {string} logData.ipAddress - IP address
 * @param {string} logData.userAgent - User agent string
 * @param {Object} logData.metadata - Additional metadata
 * @param {string} logData.status - Status (SUCCESS/FAILURE)
 * @param {string} logData.errorMessage - Error message if failed
 */
export async function createAuditLog({
    userId,
    action,
    entityType = null,
    entityId = null,
    ipAddress = null,
    userAgent = null,
    metadata = {},
    status = 'SUCCESS',
    errorMessage = null
}) {
    // Skip audit log if no userId (avoids NOT NULL constraint errors)
    if (!userId) return;

    // Fire-and-forget with a timeout so it never blocks or crashes the main flow
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Audit log timeout')), 3000)
    );

    Promise.race([
        supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: {
                ...metadata,
                status,
                errorMessage
            }
        }),
        timeout
    ]).then(({ error } = {}) => {
        if (error) console.warn('Failed to create audit log:', error.message);
    }).catch((err) => {
        console.warn('Audit log skipped:', err.message);
    });
}

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - IP address
 */
export function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        'unknown';
}

/**
 * Audit log action types
 */
export const AUDIT_ACTIONS = {
    // Authentication
    USER_REGISTER: 'USER_REGISTER',
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    OTP_SENT: 'OTP_SENT',
    OTP_VERIFIED: 'OTP_VERIFIED',
    OTP_FAILED: 'OTP_FAILED',
    TOKEN_REFRESH: 'TOKEN_REFRESH',

    // Patient
    PATIENT_CREATED: 'PATIENT_CREATED',
    PATIENT_UPDATED: 'PATIENT_UPDATED',
    PATIENT_ID_GENERATED: 'PATIENT_ID_GENERATED',
    PATIENT_PROFILE_VIEWED: 'PATIENT_PROFILE_VIEWED',

    // Medical Records
    MEDICAL_RECORD_UPLOADED: 'MEDICAL_RECORD_UPLOADED',
    MEDICAL_RECORD_VIEWED: 'MEDICAL_RECORD_VIEWED',
    MEDICAL_RECORD_DELETED: 'MEDICAL_RECORD_DELETED',

    // Security
    UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    INVALID_TOKEN: 'INVALID_TOKEN',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',

    // Emergency
    EMERGENCY_ALERT_CREATED: 'EMERGENCY_ALERT_CREATED'
};
