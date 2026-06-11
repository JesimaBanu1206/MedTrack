/**
 * activityLogger.js
 * Hospital-scoped activity logging utility
 */

import supabase from '../config/supabase.js';

export async function createActivityLog({
    hospitalId = null,
    userId = null,
    action,
    entityType = null,
    entityId = null,
    ipAddress = null,
    metadata = {}
}) {
    // Fire-and-forget with 3s timeout — never blocks the main request
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Activity log timeout')), 3000)
    );

    Promise.race([
        supabase.from('activity_logs').insert({
            hospital_id: hospitalId,
            user_id:     userId,
            action,
            entity_type: entityType,
            entity_id:   entityId,
            ip_address:  ipAddress,
            metadata,
            created_at:  new Date().toISOString()
        }),
        timeout
    ]).catch((err) => {
        console.warn('[ActivityLog] Skipped:', err.message);
    });
}
