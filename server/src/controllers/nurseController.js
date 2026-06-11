/**
 * nurseController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Nurse dashboard actions: vitals recording, patient queue, ward management
 * ─────────────────────────────────────────────────────────────────────────────
 */

import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { createActivityLog } from '../utils/activityLogger.js';

// ─────────────────────────────────────────────────────────────────────────────
// NURSE DASHBOARD
// GET /api/nurse/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getNurseDashboard(req, res, next) {
    const hospitalId = req.user.hospitalId;

    try {
        const today = new Date().toISOString().split('T')[0];

        // Today's queue
        const { data: queueData } = await supabase
            .from('op_queue')
            .select('id, token_number, patient_name, age, gender, reason, bp, temperature, heart_rate, status, triage_status, created_at')
            .eq('hospital_id', hospitalId)
            .eq('queue_date', today)
            .order('token_number', { ascending: true });

        // Today's vitals recorded by this nurse
        const { data: todayVitals } = await supabase
            .from('nurse_vitals')
            .select('id, patient_name, bp, temperature, heart_rate, sugar, weight, spo2, recorded_at')
            .eq('hospital_id', hospitalId)
            .eq('nurse_user_id', req.user.id)
            .gte('recorded_at', `${today}T00:00:00Z`)
            .order('recorded_at', { ascending: false })
            .limit(20);

        // Admin notices
        const { data: notices } = await supabase
            .from('admin_notices')
            .select('id, title, message, priority, created_at')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(5);

        // Pending lab requests
        const { data: pendingLabs } = await supabase
            .from('lab_requests')
            .select('id, patient_name, test_type, urgency, status, created_at')
            .eq('hospital_id', hospitalId)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(10);

        const queueList = queueData || [];
        const stats = {
            totalQueue: queueList.length,
            waiting: queueList.filter(q => q.status === 'WAITING').length,
            inConsultation: queueList.filter(q => q.status === 'IN_CONSULTATION').length,
            completed: queueList.filter(q => q.status === 'COMPLETED').length,
            critical: queueList.filter(q => q.triage_status === 'CRITICAL').length,
            vitalsRecordedToday: (todayVitals || []).length
        };

        res.status(200).json({
            success: true,
            data: {
                stats,
                queue: queueList,
                todayVitals: todayVitals || [],
                notices: notices || [],
                pendingLabs: pendingLabs || []
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD VITALS
// POST /api/nurse/vitals
// ─────────────────────────────────────────────────────────────────────────────
export async function recordVitals(req, res, next) {
    const {
        patientId, patientPid, queueEntryId, patientName,
        bp, temperature, heartRate, sugar, weight,
        spo2, respiration, painScale, notes
    } = req.body;

    try {
        let resolvedPatientId = patientId || null;
        let resolvedPatientName = patientName || null;

        if ((!resolvedPatientId || !resolvedPatientName) && patientPid) {
            const { data: p } = await supabase
                .from('patients')
                .select('id, full_name')
                .eq('patient_id', patientPid)
                .maybeSingle();
            if (p) {
                resolvedPatientId = resolvedPatientId || p.id;
                resolvedPatientName = resolvedPatientName || p.full_name;
            }
        }

        const { data, error } = await supabase
            .from('nurse_vitals')
            .insert({
                hospital_id: req.user.hospitalId,
                nurse_user_id: req.user.id,
                patient_id: resolvedPatientId,
                queue_entry_id: queueEntryId || null,
                patient_name: resolvedPatientName,
                bp,
                temperature,
                heart_rate: heartRate ? parseInt(heartRate) : null,
                sugar,
                weight: weight ? parseFloat(weight) : null,
                spo2: spo2 ? parseInt(spo2) : null,
                respiration: respiration ? parseInt(respiration) : null,
                pain_scale: painScale !== undefined ? parseInt(painScale) : null,
                notes
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to record vitals: ' + error.message, 500);

        // Update the queue entry with latest vitals
        if (queueEntryId) {
            await supabase.from('op_queue').update({
                bp: bp || null,
                temperature: temperature || null,
                heart_rate: heartRate ? parseInt(heartRate) : null,
                sugar: sugar || null,
                weight: weight ? parseFloat(weight) : null,
                updated_at: new Date().toISOString()
            }).eq('id', queueEntryId);
        }

        await createActivityLog({
            hospitalId: req.user.hospitalId,
            userId: req.user.id,
            action: 'VITALS_RECORDED',
            entityType: 'nurse_vitals',
            entityId: data.id,
            ipAddress: req.ip,
            metadata: { patientName: resolvedPatientName, patientPid: patientPid || null, bp, heartRate }
        });

        res.status(201).json({ success: true, message: 'Vitals recorded', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET VITALS HISTORY FOR A PATIENT
// GET /api/nurse/vitals/:patientId
// ─────────────────────────────────────────────────────────────────────────────
export async function getPatientVitalsHistory(req, res, next) {
    const { patientId } = req.params;
    const { limit = 20 } = req.query;

    try {
        const { data, error } = await supabase
            .from('nurse_vitals')
            .select('*')
            .eq('hospital_id', req.user.hospitalId)
            .eq('patient_id', patientId)
            .order('recorded_at', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw new AppError('Failed to fetch vitals', 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PATIENT STATUS (in queue)
// PATCH /api/nurse/queue/:queueId/status
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePatientStatus(req, res, next) {
    const { queueId } = req.params;
    const { status, triageStatus, notes } = req.body;

    try {
        const update = { updated_at: new Date().toISOString() };
        if (status) update.status = status;
        if (triageStatus) update.triage_status = triageStatus;

        const { data, error } = await supabase
            .from('op_queue')
            .update(update)
            .eq('id', queueId)
            .eq('hospital_id', req.user.hospitalId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update patient status', 500);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TODAY'S QUEUE (nurse view — all patients in hospital)
// GET /api/nurse/queue
// ─────────────────────────────────────────────────────────────────────────────
export async function getNurseQueue(req, res, next) {
    const { date, status } = req.query;

    try {
        const queryDate = date || new Date().toISOString().split('T')[0];

        let query = supabase
            .from('op_queue')
            .select('*')
            .eq('hospital_id', req.user.hospitalId)
            .eq('queue_date', queryDate)
            .order('triage_status', { ascending: true })   // CRITICAL first
            .order('token_number', { ascending: true });

        if (status && status !== 'all') query = query.eq('status', status.toUpperCase());

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch queue', 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOK UP PATIENT BY PID (nurse use)
// GET /api/nurse/patient/:patientPid
// Returns patient details + latest vitals for the nurse's vitals form.
// ─────────────────────────────────────────────────────────────────────────────
export async function getNursePatient(req, res, next) {
    const { patientPid } = req.params;
    try {
        const { data: patient, error } = await supabase
            .from('patients')
            .select('id, patient_id, full_name, dob, gender, blood_group, allergies, medical_history')
            .eq('patient_id', patientPid)
            .single();

        if (error || !patient) throw new AppError('Patient not found', 404);

        let age = null;
        if (patient.dob) {
            const diff = Date.now() - new Date(patient.dob).getTime();
            age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }

        // Latest vitals
        const { data: latestVitals } = await supabase
            .from('nurse_vitals')
            .select('bp, temperature, heart_rate, sugar, weight, spo2, recorded_at')
            .eq('patient_id', patient.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        res.status(200).json({
            success: true,
            data: { ...patient, age, latestVitals: latestVitals || null }
        });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL LAB REQUESTS (lab technician view)
// GET /api/nurse/lab-requests
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllLabRequests(req, res, next) {
    const { status, urgency, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        let query = supabase
            .from('lab_requests')
            .select('*', { count: 'exact' })
            .eq('hospital_id', req.user.hospitalId)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') query = query.eq('status', status.toUpperCase());
        if (urgency && urgency !== 'all') query = query.eq('urgency', urgency.toUpperCase());
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to fetch lab requests', 500);

        res.status(200).json({
            success: true,
            data: data || [],
            pagination: { total: count || 0, page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE LAB REQUEST (nurse/lab tech marks as done)
// PATCH /api/nurse/lab-requests/:requestId/complete
// ─────────────────────────────────────────────────────────────────────────────
export async function completeLabRequest(req, res, next) {
    const { requestId } = req.params;
    const { resultNotes, resultUrl } = req.body;

    try {
        const { data, error } = await supabase
            .from('lab_requests')
            .update({
                status: 'COMPLETED',
                result_notes: resultNotes,
                result_url: resultUrl || null,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('hospital_id', req.user.hospitalId)
            .select()
            .single();

        if (error) throw new AppError('Failed to complete lab request', 500);

        res.status(200).json({ success: true, message: 'Lab request completed', data });
    } catch (error) {
        next(error);
    }
}
