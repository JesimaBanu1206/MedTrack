import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';

/**
 * POST /api/emergency/alert
 * Handles emergency capture upload
 */
export async function createEmergencyAlert(req, res, next) {
    const userId = req.user?.id; // Optional, might be guest
    const { image, latitude, longitude, timestamp, patientId } = req.body;

    try {
        if (!image) {
            throw new AppError('Image is required', 400);
        }

        // 1. Upload image to Supabase Storage
        // Base64 to Buffer
        console.log('Emergency Alert: Processing image upload...');
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        const fileName = `emergency-${Date.now()}.jpg`;
        const filePath = `emergency-alerts/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('medical-records') // Using existing bucket
            .upload(filePath, buffer, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            console.error('Emergency image upload error:', uploadError);
            throw new AppError(`Failed to upload emergency image: ${uploadError.message}`, 500);
        }

        // 2. Get Public URL
        const { data: urlData } = supabase
            .storage
            .from('medical-records')
            .getPublicUrl(filePath);

        if (!urlData || !urlData.publicUrl) {
            throw new AppError('Failed to generate public URL for emergency image', 500);
        }

        // 3. Store in database
        console.log('Emergency Alert: Storing unassigned alert in database...');

        // Robust parsing for coordinates
        const numLat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
        const numLng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;

        const { data: dbData, error: dbError } = await supabase
            .from('emergency_alerts')
            .insert({
                user_id: userId || null,
                patient_id: patientId || null,
                image_url: urlData.publicUrl,
                latitude: (numLat !== null && !isNaN(numLat)) ? numLat : null,
                longitude: (numLng !== null && !isNaN(numLng)) ? numLng : null,
                status: 'PENDING', // Initial status: Not assigned yet
                assigned_unit_no: null, // No unit assigned yet
                unit_details: null, // No driver details yet
                metadata: {
                    captured_at: timestamp,
                    device: req.headers['user-agent']
                }
            })
            .select()
            .single();

        const alertRecord = dbError ? null : dbData;

        if (dbError) {
            console.error('Emergency database insertion error:', dbError.message);
        }

        // 4. Always create an audit log
        try {
            await createAuditLog({
                userId: userId || null,
                action: 'EMERGENCY_ALERT_CREATED',
                entityType: 'emergency_alert',
                entityId: alertRecord?.id || null,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: {
                    imageUrl: urlData.publicUrl,
                    location: { latitude, longitude },
                    timestamp,
                    status: alertRecord ? 'SUCCESS' : 'DB_INSERT_FAILED',
                    dbErrorMessage: dbError?.message
                },
                status: alertRecord ? 'SUCCESS' : 'FAILURE'
            });
        } catch (auditError) {
            console.error('Audit log failed during emergency alert:', auditError);
        }

        // If DB insertion failed, throw error now so the client knows
        if (dbError) {
            throw new AppError(`Emergency alert created in storage but failed to save in database: ${dbError.message}`, 500);
        }

        res.status(201).json({
            success: true,
            message: 'Emergency alert sent successfully. Help is on the way.',
            data: {
                alertId: alertRecord?.id,
                imageUrl: urlData.publicUrl,
                assignedUnitNo: alertRecord?.assigned_unit_no
            }
        });

    } catch (error) {
        console.error('Detailed Emergency Alert Error:', error);
        next(error);
    }
}
