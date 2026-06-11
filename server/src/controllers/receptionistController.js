/**
 * receptionistController.js
 * Receptionist portal:
 *  - Dashboard with live queue stats
 *  - OP timing CRUD (changes reflect immediately in patient appointment page)
 *  - Queue management (walk-in + online bookings)
 *  - Patient search
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { config } from '../config/env.js';

/* ── Helper: get hospital_id from logged-in user ────────────────────────── */
async function resolveHospitalId(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('hospital_id')
        .eq('id', userId)
        .single();
    if (error || !data?.hospital_id) throw new AppError('Not linked to a hospital', 403);
    return data.hospital_id;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// POST /api/receptionist/login
// ─────────────────────────────────────────────────────────────────────────────
export async function receptionistLogin(req, res, next) {
    const { email, password } = req.body;
    try {
        if (!email || !password) throw new AppError('Email and password required', 400);

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, password_hash, is_active, is_deleted, hospital_id, full_name, roles(name)')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) throw new AppError('Invalid credentials', 401);
        if (user.is_deleted) throw new AppError('Account removed', 403);
        if (!user.is_active)  throw new AppError('Account inactive. Contact admin.', 403);

        const allowedRoles = ['RECEPTIONIST', 'HOSPITAL_ADMIN'];
        if (!allowedRoles.includes(user.roles?.name))
            throw new AppError('Access denied. Not a receptionist account.', 403);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new AppError('Invalid credentials', 401);

        // Fetch hospital details
        const { data: hospital } = await supabase
            .from('hospitals')
            .select('id, hospital_name, type, district, address')
            .eq('id', user.hospital_id)
            .single();

        const accessToken  = generateAccessToken({ userId: user.id, role: user.roles.name });
        const refreshToken = generateRefreshToken({ userId: user.id });
        const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const { error: tokenError } = await supabase
            .from('refresh_tokens')
            .insert({
                user_id: user.id,
                token: refreshToken,
                device_info: req.headers['user-agent'],
                ip_address: req.ip,
                expires_at: refreshExpiresAt.toISOString(),
            });

        if (tokenError) {
            throw new AppError('Failed to start session. Please try again.', 500);
        }

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.roles.name,
                    hospitalId: user.hospital_id,
                    hospital,
                },
            },
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// GET /api/receptionist/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getReceptionistDashboard(req, res, next) {
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const today = new Date().toISOString().split('T')[0];

        // Today's queue
        const { data: appts } = await supabase
            .from('op_queue')
            .select('id, token_number, patient_name, patient_pid, department, status, triage_status, preferred_time, consultation_type, visit_date, created_at')
            .eq('hospital_id', hospitalId)
            .eq('visit_date', today)
            .order('token_number', { ascending: true });

        const queue = appts || [];

        // Available beds
        const { data: beds } = await supabase
            .from('beds')
            .select('status')
            .eq('hospital_id', hospitalId);
        const availBeds = (beds || []).filter(b => b.status === 'AVAILABLE').length;

        // Today's OP timings
        const { data: opTimings } = await supabase
            .from('op_timings')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('timing_date', today)
            .eq('is_active', true)
            .order('department');

        return res.status(200).json({
            success: true,
            data: {
                today,
                stats: {
                    totalAppointments: queue.length,
                    waiting:      queue.filter(a => a.status === 'WAITING').length,
                    inProgress:   queue.filter(a => a.status === 'IN_CONSULTATION').length,
                    completed:    queue.filter(a => a.status === 'COMPLETED').length,
                    cancelled:    queue.filter(a => a.status === 'CANCELLED').length,
                    online:       queue.filter(a => a.consultation_type === 'ONLINE').length,
                    availableBeds: availBeds,
                },
                recentQueue: queue.slice(0, 30),
                opTimings: opTimings || [],
            },
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET APPOINTMENTS (filterable by date, dept, status, type)
// GET /api/receptionist/appointments?date=&department=&status=&type=
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodayAppointments(req, res, next) {
    const { date, department, status, type } = req.query;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const queryDate  = date || new Date().toISOString().split('T')[0];

        let query = supabase
            .from('op_queue')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('visit_date', queryDate)
            .order('token_number', { ascending: true });

        if (department)               query = query.eq('department', department);
        if (status && status !== 'all') query = query.eq('status', status.toUpperCase());
        if (type && type !== 'all')     query = query.eq('consultation_type', type.toUpperCase());

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch appointments', 500);

        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE APPOINTMENT STATUS
// PATCH /api/receptionist/appointments/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function updateAppointmentStatus(req, res, next) {
    const { id } = req.params;
    const { status, notes } = req.body;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        const { data, error } = await supabase
            .from('op_queue')
            .update({ status: status.toUpperCase(), notes: notes || null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('hospital_id', hospitalId)
            .select()
            .single();

        if (error) throw new AppError('Update failed: ' + error.message, 500);
        return res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET OP TIMINGS BY DATE
// GET /api/receptionist/op-timings?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
export async function getOpTimings(req, res, next) {
    const { date } = req.query;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const queryDate  = date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('op_timings')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('timing_date', queryDate)
            .eq('is_active', true)
            .order('department', { ascending: true });

        if (error) throw new AppError('Failed to fetch OP timings', 500);
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT OP TIMING (create or update)
// POST /api/receptionist/op-timings
// → Changes reflect immediately in /api/appointments/op-timings (patient page)
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertOpTiming(req, res, next) {
    const { department, timing_date, start_time, end_time, slot_duration_minutes, max_patients, doctor_name, notes } = req.body;
    try {
        if (!department || !timing_date || !start_time || !end_time) {
            throw new AppError('department, timing_date, start_time, end_time are required', 400);
        }

        const hospitalId = await resolveHospitalId(req.user.id);

        // Check if already exists
        const { data: existing } = await supabase
            .from('op_timings')
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('timing_date', timing_date)
            .eq('department', department)
            .maybeSingle();

        let result;
        if (existing?.id) {
            // UPDATE existing — this immediately changes what patients see
            const { data, error } = await supabase
                .from('op_timings')
                .update({
                    start_time,
                    end_time,
                    slot_duration_minutes: slot_duration_minutes || 15,
                    max_patients: max_patients || 60,
                    doctor_name: doctor_name || null,
                    notes: notes || null,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw new AppError('Update failed: ' + error.message, 500);
            result = data;
        } else {
            // INSERT new
            const { data, error } = await supabase
                .from('op_timings')
                .insert({
                    hospital_id: hospitalId,
                    department,
                    timing_date,
                    start_time,
                    end_time,
                    slot_duration_minutes: slot_duration_minutes || 15,
                    max_patients: max_patients || 60,
                    doctor_name: doctor_name || null,
                    notes: notes || null,
                    is_active: true,
                    created_by: req.user.id,
                })
                .select()
                .single();

            if (error) throw new AppError('Insert failed: ' + error.message, 500);
            result = data;
        }

        return res.status(200).json({
            success: true,
            message: existing?.id ? 'OP timing updated' : 'OP timing created',
            data: result,
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PATIENT
// GET /api/receptionist/search-patient?q=
// ─────────────────────────────────────────────────────────────────────────────
export async function searchPatient(req, res, next) {
    const { q } = req.query;
    try {
        if (!q || q.trim().length < 2) {
            return res.status(200).json({ success: true, data: [] });
        }

        const { data, error } = await supabase
            .from('patients')
            .select('id, patient_pid, full_name, phone, age, gender, blood_group, address')
            .or(`patient_pid.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
            .limit(10);

        if (error) throw new AppError('Search failed', 500);
        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// WALK-IN CHECK-IN
// POST /api/receptionist/walk-in
// ─────────────────────────────────────────────────────────────────────────────
export async function walkInCheckin(req, res, next) {
    const { patientPid, patientName, age, gender, department, reason, triageStatus } = req.body;
    try {
        if (!patientName || !department) throw new AppError('patientName and department required', 400);

        const hospitalId = await resolveHospitalId(req.user.id);
        const today = new Date().toISOString().split('T')[0];

        // Get next token
        const { count } = await supabase
            .from('op_queue')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            .eq('visit_date', today)
            .eq('department', department);

        const tokenNumber = (count || 0) + 1;

        // Resolve patient_id if PID given
        let patientId = null;
        if (patientPid) {
            const { data: p } = await supabase
                .from('patients')
                .select('id')
                .eq('patient_pid', patientPid.trim().toUpperCase())
                .maybeSingle();
            patientId = p?.id || null;
        }

        const { data, error } = await supabase
            .from('op_queue')
            .insert({
                hospital_id: hospitalId,
                patient_id: patientId,
                patient_pid: patientPid?.trim().toUpperCase() || null,
                patient_name: patientName,
                age: age || null,
                gender: gender || null,
                department,
                reason: reason || null,
                token_number: tokenNumber,
                triage_status: triageStatus || 'NORMAL',
                status: 'WAITING',
                visit_date: today,
                consultation_type: 'IN_PERSON',
                booked_online: false,
                registered_by: req.user.id,
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to add to queue: ' + error.message, 500);
        return res.status(201).json({ success: true, data: { ...data, tokenNumber } });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET LIVE QUEUE STATUS
// GET /api/receptionist/queue?department=&date=
// ─────────────────────────────────────────────────────────────────────────────
export async function getQueueStatus(req, res, next) {
    const { department, date } = req.query;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const queryDate  = date || new Date().toISOString().split('T')[0];

        let query = supabase
            .from('op_queue')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('visit_date', queryDate)
            .order('token_number', { ascending: true });

        if (department) query = query.eq('department', department);

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch queue', 500);

        const queue = data || [];

        return res.status(200).json({
            success: true,
            data: {
                queue,
                currentToken: queue.find(q => q.status === 'IN_CONSULTATION')?.token_number || null,
                waitingCount: queue.filter(q => q.status === 'WAITING').length,
                totalToday: queue.length,
            },
        });
    } catch (err) { next(err); }
}
