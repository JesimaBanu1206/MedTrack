/**
 * doctorController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Doctor + Nurse login, dashboard, attendance, OP queue, prescriptions, AI analysis
 * All queries are scoped to req.user.hospitalId for strict data isolation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { config } from '../config/env.js';
import { createActivityLog } from '../utils/activityLogger.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: resolve doctor_profile from user_id
// ─────────────────────────────────────────────────────────────────────────────
async function resolveDoctorProfile(userId) {
    const { data, error } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        // Auto-create doctor profile if missing (linked to user's hospital_id)
        const { data: user } = await supabase
            .from('users')
            .select('id, hospital_id, full_name')
            .eq('id', userId)
            .single();

        if (!user?.hospital_id) throw new AppError('Doctor is not linked to a hospital', 403);

        const { data: created, error: createErr } = await supabase
            .from('doctor_profiles')
            .insert({ user_id: userId, hospital_id: user.hospital_id })
            .select()
            .single();

        if (createErr) throw new AppError('Failed to create doctor profile', 500);
        return created;
    }
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR / NURSE LOGIN
// POST /api/doctor/login
// ─────────────────────────────────────────────────────────────────────────────
export async function doctorLogin(req, res, next) {
    const { email, password } = req.body;

    try {
        // Fetch user + role
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, email, phone, password_hash, role_id, is_active, is_verified, hospital_id, full_name, roles(name)')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (userErr || !user) throw new AppError('Invalid credentials', 401);

        const roleName = user.roles?.name;
        const allowedRoles = ['DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RECEPTIONIST', 'OTHER_STAFF'];
        if (!allowedRoles.includes(roleName)) throw new AppError('Access denied. Staff portal only.', 403);
        if (!user.is_active) throw new AppError('Account deactivated. Contact Hospital Admin.', 403);

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) throw new AppError('Invalid credentials', 401);

        // Get staff profile
        const { data: staffProfile } = await supabase
            .from('staff_profiles')
            .select('id, full_name, department, staff_role')
            .eq('user_id', user.id)
            .maybeSingle();

        // Get hospital info
        let hospital = null;
        if (user.hospital_id) {
            const { data: hosp } = await supabase
                .from('hospitals')
                .select('id, hospital_name, city, district')
                .eq('id', user.hospital_id)
                .single();
            hospital = hosp;
        }

        // For doctors, get/create doctor profile
        let doctorProfile = null;
        if (roleName === 'DOCTOR') {
            doctorProfile = await resolveDoctorProfile(user.id);
        }

        const accessToken = generateAccessToken({
            userId: user.id,
            roleId: user.role_id,
            role: roleName,
            hospitalId: user.hospital_id
        });

        const refreshToken = generateRefreshToken({ userId: user.id });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await supabase.from('refresh_tokens').insert({
            user_id: user.id,
            token: refreshToken,
            device_info: req.headers['user-agent'],
            ip_address: req.ip,
            expires_at: expiresAt.toISOString()
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: roleName,
                    fullName: staffProfile?.full_name || user.full_name,
                    department: staffProfile?.department,
                    hospitalId: user.hospital_id,
                    hospital,
                    doctorProfile
                }
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DOCTOR PROFILE
// GET /api/doctor/profile
// ─────────────────────────────────────────────────────────────────────────────
export async function getDoctorProfile(req, res, next) {
    try {
        const userId = req.user.id;

        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, email, phone, full_name, hospital_id')
            .eq('id', userId)
            .single();

        if (userErr || !user) throw new AppError('User not found', 404);

        const { data: staffProfile } = await supabase
            .from('staff_profiles')
            .select('id, full_name, department, staff_role, phone')
            .eq('user_id', userId)
            .maybeSingle();

        let doctorProfile = null;
        let hospital = null;

        if (req.user.role === 'DOCTOR') {
            doctorProfile = await resolveDoctorProfile(userId);
        }

        if (user.hospital_id) {
            const { data: hosp } = await supabase
                .from('hospitals')
                .select('id, hospital_name, city, district, contact_phone, contact_email')
                .eq('id', user.hospital_id)
                .single();
            hospital = hosp;
        }

        res.status(200).json({
            success: true,
            data: {
                userId: user.id,
                email: user.email,
                phone: staffProfile?.phone || user.phone,
                fullName: staffProfile?.full_name || user.full_name,
                department: staffProfile?.department,
                role: staffProfile?.staff_role || req.user.role,
                doctorUniqueId: doctorProfile?.doctor_unique_id,
                specialization: doctorProfile?.specialization,
                qualification: doctorProfile?.qualification,
                experienceYears: doctorProfile?.experience_years,
                consultationFee: doctorProfile?.consultation_fee,
                languages: doctorProfile?.languages,
                hospital
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE DOCTOR PROFILE
// PUT /api/doctor/profile
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDoctorProfile(req, res, next) {
    const { specialization, qualification, experienceYears, consultationFee, languages, profileBio, phone } = req.body;

    try {
        const userId = req.user.id;

        // Update staff profile phone
        if (phone) {
            await supabase.from('staff_profiles')
                .update({ phone, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
            await supabase.from('users')
                .update({ phone, updated_at: new Date().toISOString() })
                .eq('id', userId);
        }

        if (req.user.role === 'DOCTOR') {
            const doctorProfile = await resolveDoctorProfile(userId);
            const updates = {};
            if (specialization !== undefined) updates.specialization = specialization;
            if (qualification !== undefined) updates.qualification = qualification;
            if (experienceYears !== undefined) updates.experience_years = parseInt(experienceYears);
            if (consultationFee !== undefined) updates.consultation_fee = parseFloat(consultationFee);
            if (languages !== undefined) updates.languages = languages;
            if (profileBio !== undefined) updates.profile_bio = profileBio;

            if (Object.keys(updates).length > 0) {
                updates.updated_at = new Date().toISOString();
                await supabase.from('doctor_profiles').update(updates).eq('id', doctorProfile.id);
            }
        }

        res.status(200).json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// POST /api/doctor/change-password
// ─────────────────────────────────────────────────────────────────────────────
export async function changeDoctorPassword(req, res, next) {
    const { currentPassword, newPassword } = req.body;
    try {
        if (!currentPassword || !newPassword) throw new AppError('Both passwords required', 400);
        if (newPassword.length < 6) throw new AppError('New password must be at least 6 characters', 400);

        const { data: user } = await supabase
            .from('users').select('id, password_hash').eq('id', req.user.id).single();

        if (!user) throw new AppError('User not found', 404);

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) throw new AppError('Current password is incorrect', 401);

        const newHash = await bcrypt.hash(newPassword, 12);
        await supabase.from('users')
            .update({ password_hash: newHash, updated_at: new Date().toISOString() })
            .eq('id', req.user.id);

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TODAY'S SCHEDULE
// GET /api/doctor/schedule/today
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodaySchedule(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const { data: schedules, error } = await supabase
            .from('doctor_schedules')
            .select('*')
            .eq('doctor_id', doctorProfile.id)
            .in('schedule_date', [today, tomorrow])
            .eq('is_active', true)
            .order('schedule_date', { ascending: true })
            .order('shift_start', { ascending: true });

        if (error) throw new AppError('Failed to fetch schedule', 500);

        const todaySchedules = (schedules || []).filter(s => s.schedule_date === today);
        const tomorrowSchedules = (schedules || []).filter(s => s.schedule_date === tomorrow);

        res.status(200).json({
            success: true,
            data: {
                today: todaySchedules,
                tomorrow: tomorrowSchedules
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — CHECK IN (login)
// POST /api/doctor/attendance/check-in
// ─────────────────────────────────────────────────────────────────────────────
export async function attendanceCheckIn(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];

        // Check existing record
        const { data: existing } = await supabase
            .from('doctor_attendance')
            .select('id, login_time, status')
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .maybeSingle();

        if (existing?.login_time) {
            return res.status(200).json({
                success: true,
                message: 'Already checked in',
                data: existing
            });
        }

        const now = new Date().toISOString();
        let record;

        if (existing) {
            const { data, error } = await supabase
                .from('doctor_attendance')
                .update({ login_time: now, status: 'ON_DUTY', updated_at: now })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw new AppError('Failed to check in', 500);
            record = data;
        } else {
            const { data, error } = await supabase
                .from('doctor_attendance')
                .insert({
                    doctor_id: doctorProfile.id,
                    hospital_id: doctorProfile.hospital_id,
                    attendance_date: today,
                    login_time: now,
                    status: 'ON_DUTY'
                })
                .select()
                .single();
            if (error) throw new AppError('Failed to check in: ' + error.message, 500);
            record = data;
        }

        await createActivityLog({
            hospitalId: doctorProfile.hospital_id,
            userId: req.user.id,
            action: 'DOCTOR_CHECK_IN',
            entityType: 'doctor_attendance',
            entityId: record.id,
            ipAddress: req.ip,
            metadata: { doctorId: doctorProfile.id, date: today }
        });

        res.status(200).json({ success: true, message: 'Checked in successfully', data: record });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — BREAK START
// POST /api/doctor/attendance/break-start
// ─────────────────────────────────────────────────────────────────────────────
export async function attendanceBreakStart(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const { data: record, error } = await supabase
            .from('doctor_attendance')
            .update({ break_start: now, status: 'ON_BREAK', updated_at: now })
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .select()
            .single();

        if (error) throw new AppError('No active attendance found', 404);

        res.status(200).json({ success: true, message: 'Break started', data: record });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — BREAK END
// POST /api/doctor/attendance/break-end
// ─────────────────────────────────────────────────────────────────────────────
export async function attendanceBreakEnd(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const { data: record, error } = await supabase
            .from('doctor_attendance')
            .update({ break_end: now, status: 'ON_DUTY', updated_at: now })
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .select()
            .single();

        if (error) throw new AppError('No active attendance found', 404);

        res.status(200).json({ success: true, message: 'Break ended', data: record });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — CHECK OUT (logout)
// POST /api/doctor/attendance/check-out
// ─────────────────────────────────────────────────────────────────────────────
export async function attendanceCheckOut(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const { data: existing } = await supabase
            .from('doctor_attendance')
            .select('login_time')
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .single();

        let totalMinutes = 0;
        if (existing?.login_time) {
            totalMinutes = Math.round((new Date(now) - new Date(existing.login_time)) / 60000);
        }

        const { data: record, error } = await supabase
            .from('doctor_attendance')
            .update({ logout_time: now, status: 'OFF_DUTY', total_minutes: totalMinutes, updated_at: now })
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .select()
            .single();

        if (error) throw new AppError('Failed to check out', 500);

        await createActivityLog({
            hospitalId: doctorProfile.hospital_id,
            userId: req.user.id,
            action: 'DOCTOR_CHECK_OUT',
            entityType: 'doctor_attendance',
            entityId: record.id,
            ipAddress: req.ip,
            metadata: { doctorId: doctorProfile.id, totalMinutes }
        });

        res.status(200).json({ success: true, message: 'Checked out successfully', data: record });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TODAY'S ATTENDANCE
// GET /api/doctor/attendance/today
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodayAttendance(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];

        const { data: record } = await supabase
            .from('doctor_attendance')
            .select('*')
            .eq('doctor_id', doctorProfile.id)
            .eq('attendance_date', today)
            .maybeSingle();

        res.status(200).json({ success: true, data: record || null });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DASHBOARD DATA (schedule + attendance + resources + notices + queue)
// GET /api/doctor/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getDoctorDashboard(req, res, next) {
    try {
        const userId = req.user.id;
        const hospitalId = req.user.hospitalId;

        // Doctor profile
        let doctorProfile = null;
        try { doctorProfile = await resolveDoctorProfile(userId); } catch (_) {}

        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // Schedule
        let schedules = { today: [], tomorrow: [] };
        if (doctorProfile) {
            const { data: sched } = await supabase
                .from('doctor_schedules')
                .select('*')
                .eq('doctor_id', doctorProfile.id)
                .in('schedule_date', [today, tomorrow])
                .eq('is_active', true)
                .order('shift_start');

            schedules.today    = (sched || []).filter(s => s.schedule_date === today);
            schedules.tomorrow = (sched || []).filter(s => s.schedule_date === tomorrow);
        }

        // Attendance
        let attendance = null;
        if (doctorProfile) {
            const { data: att } = await supabase
                .from('doctor_attendance')
                .select('*')
                .eq('doctor_id', doctorProfile.id)
                .eq('attendance_date', today)
                .maybeSingle();
            attendance = att;
        }

        // Hospital resources
        let resources = null;
        if (hospitalId) {
            const { data: res_ } = await supabase
                .from('hospital_resources')
                .select('*')
                .eq('hospital_id', hospitalId)
                .maybeSingle();
            resources = res_;
        }

        // Admin notices (active, not expired)
        let notices = [];
        if (hospitalId) {
            const { data: n } = await supabase
                .from('admin_notices')
                .select('*')
                .eq('hospital_id', hospitalId)
                .eq('is_active', true)
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .order('created_at', { ascending: false })
                .limit(5);
            notices = n || [];
        }

        // OP Queue for today
        let queueStats = { total: 0, waiting: 0, inConsultation: 0, completed: 0 };
        if (doctorProfile && hospitalId) {
            const { data: queueData } = await supabase
                .from('op_queue')
                .select('status')
                .eq('doctor_id', doctorProfile.id)
                .eq('queue_date', today)
                .eq('hospital_id', hospitalId);

            if (queueData) {
                queueStats.total          = queueData.length;
                queueStats.waiting        = queueData.filter(q => q.status === 'WAITING').length;
                queueStats.inConsultation = queueData.filter(q => q.status === 'IN_CONSULTATION').length;
                queueStats.completed      = queueData.filter(q => q.status === 'COMPLETED').length;
            }
        }

        // Inpatients count (ward patients)
        let inpatientCount = 0;
        if (hospitalId) {
            const { count } = await supabase
                .from('op_queue')
                .select('id', { count: 'exact', head: true })
                .eq('hospital_id', hospitalId)
                .eq('queue_date', today)
                .eq('status', 'WAITING');
            inpatientCount = count || 0;
        }

        res.status(200).json({
            success: true,
            data: {
                schedules,
                attendance,
                resources,
                notices,
                queueStats,
                inpatientCount
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET OP QUEUE
// GET /api/doctor/queue?date=&status=
// ─────────────────────────────────────────────────────────────────────────────
export async function getOPQueue(req, res, next) {
    const { date, status, type = 'queue' } = req.query;
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const queryDate = date || new Date().toISOString().split('T')[0];

        let query = supabase
            .from('op_queue')
            .select('*')
            .eq('hospital_id', req.user.hospitalId)
            .eq('queue_date', queryDate)
            .order('token_number', { ascending: true });

        // Queue tab: doctor's own queue; Inpatients: all hospital
        if (type === 'queue') {
            query = query.eq('doctor_id', doctorProfile.id);
        }

        if (status && status !== 'all') {
            query = query.eq('status', status.toUpperCase());
        }

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch queue', 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PATIENT TO QUEUE
// POST /api/doctor/queue
// ─────────────────────────────────────────────────────────────────────────────
export async function addToQueue(req, res, next) {
    const { patientName, patientPid, age, gender, reason, bp, temperature, heartRate, sugar, weight, triageStatus } = req.body;

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const today = new Date().toISOString().split('T')[0];

        // Get next token number
        const { count } = await supabase
            .from('op_queue')
            .select('id', { count: 'exact', head: true })
            .eq('doctor_id', doctorProfile.id)
            .eq('queue_date', today);

        const tokenNumber = (count || 0) + 1;

        // Try to find patient by PID
        let patientId = null;
        if (patientPid) {
            const { data: patient } = await supabase
                .from('patients')
                .select('id')
                .eq('patient_id', patientPid)
                .maybeSingle();
            patientId = patient?.id || null;
        }

        const { data, error } = await supabase
            .from('op_queue')
            .insert({
                hospital_id: doctorProfile.hospital_id,
                doctor_id: doctorProfile.id,
                queue_date: today,
                token_number: tokenNumber,
                patient_id: patientId,
                patient_name: patientName,
                patient_pid: patientPid,
                age: age ? parseInt(age) : null,
                gender,
                reason,
                bp,
                temperature,
                heart_rate: heartRate ? parseInt(heartRate) : null,
                sugar,
                weight: weight ? parseFloat(weight) : null,
                triage_status: triageStatus || 'NORMAL',
                status: 'WAITING'
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to add patient to queue: ' + error.message, 500);

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PATIENT DETAILS (for consultation)
// GET /api/doctor/patient/:patientPid
// ─────────────────────────────────────────────────────────────────────────────
export async function getPatientForConsult(req, res, next) {
    const { patientPid } = req.params;

    try {
        // Look up patient
        const { data: patient, error } = await supabase
            .from('patients')
            .select('id, patient_id, full_name, dob, gender, blood_group, allergies, medical_history')
            .eq('patient_id', patientPid)
            .single();

        if (error || !patient) throw new AppError('Patient not found', 404);

        // Calculate age
        let age = null;
        if (patient.dob) {
            const diff = Date.now() - new Date(patient.dob).getTime();
            age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }

        // Previous prescriptions (last 10, same hospital)
        const { data: prescriptions } = await supabase
            .from('prescriptions')
            .select(`
                id, diagnosis, chief_complaint, notes, follow_up_date, created_at,
                prescription_items (medicine_name, dosage, morning, afternoon, night, duration_days)
            `)
            .eq('patient_id', patient.id)
            .eq('hospital_id', req.user.hospitalId)
            .order('created_at', { ascending: false })
            .limit(10);

        // Latest vitals
        const { data: latestVitals } = await supabase
            .from('nurse_vitals')
            .select('bp, temperature, heart_rate, sugar, weight, spo2, recorded_at')
            .eq('patient_id', patient.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Lab reports
        const { data: labReports } = await supabase
            .from('lab_requests')
            .select('id, test_type, status, result_notes, completed_at, created_at')
            .eq('patient_id', patient.id)
            .eq('hospital_id', req.user.hospitalId)
            .order('created_at', { ascending: false })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                patient: { ...patient, age },
                latestVitals,
                prescriptions: prescriptions || [],
                labReports: labReports || []
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRESCRIPTION
// POST /api/doctor/prescription
// ─────────────────────────────────────────────────────────────────────────────
export async function createPrescription(req, res, next) {
    const { queueEntryId, patientId, patientName, diagnosis, chiefComplaint, notes, followUpDate, medicines, isLabRequired } = req.body;

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        // Create prescription
        const { data: prescription, error: rxErr } = await supabase
            .from('prescriptions')
            .insert({
                hospital_id: doctorProfile.hospital_id,
                doctor_id: doctorProfile.id,
                patient_id: patientId || null,
                queue_entry_id: queueEntryId || null,
                patient_name: patientName,
                diagnosis,
                chief_complaint: chiefComplaint,
                notes,
                follow_up_date: followUpDate || null,
                is_lab_required: isLabRequired || false
            })
            .select()
            .single();

        if (rxErr) throw new AppError('Failed to create prescription: ' + rxErr.message, 500);

        // Add medicine items
        if (medicines && medicines.length > 0) {
            const items = medicines.map(m => ({
                prescription_id: prescription.id,
                medicine_name: m.name,
                dosage: m.dosage,
                frequency: m.frequency,
                morning: m.morning || false,
                afternoon: m.afternoon || false,
                night: m.night || false,
                before_food: m.beforeFood || false,
                duration_days: m.durationDays || 1,
                instructions: m.instructions
            }));

            const { error: itemErr } = await supabase
                .from('prescription_items')
                .insert(items);

            if (itemErr) throw new AppError('Failed to save medicines: ' + itemErr.message, 500);
        }

        // Update queue status to COMPLETED
        if (queueEntryId) {
            await supabase
                .from('op_queue')
                .update({ status: 'COMPLETED', consulted_at: new Date().toISOString() })
                .eq('id', queueEntryId);
        }

        await createActivityLog({
            hospitalId: doctorProfile.hospital_id,
            userId: req.user.id,
            action: 'PRESCRIPTION_CREATED',
            entityType: 'prescriptions',
            entityId: prescription.id,
            ipAddress: req.ip,
            metadata: { patientName, diagnosis, medicineCount: medicines?.length || 0 }
        });

        res.status(201).json({ success: true, message: 'Prescription created', data: { prescription } });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LAB REQUEST
// POST /api/doctor/lab-request
// ─────────────────────────────────────────────────────────────────────────────
export async function createLabRequest(req, res, next) {
    const { patientId, patientName, prescriptionId, testType, urgency, notes } = req.body;

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        const { data, error } = await supabase
            .from('lab_requests')
            .insert({
                hospital_id: doctorProfile.hospital_id,
                doctor_id: doctorProfile.id,
                patient_id: patientId || null,
                prescription_id: prescriptionId || null,
                patient_name: patientName,
                test_type: testType,
                urgency: urgency || 'ROUTINE',
                notes,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create lab request: ' + error.message, 500);

        await createActivityLog({
            hospitalId: doctorProfile.hospital_id,
            userId: req.user.id,
            action: 'LAB_REQUEST_CREATED',
            entityType: 'lab_requests',
            entityId: data.id,
            ipAddress: req.ip,
            metadata: { testType, urgency, patientName }
        });

        res.status(201).json({ success: true, message: 'Lab request created', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DOCTOR'S PRESCRIPTIONS
// GET /api/doctor/prescriptions?page=&patientName=
// ─────────────────────────────────────────────────────────────────────────────
export async function getDoctorPrescriptions(req, res, next) {
    const { page = 1, limit = 20, patientName } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        let query = supabase
            .from('prescriptions')
            .select(`
                id, patient_name, diagnosis, chief_complaint, notes, follow_up_date, created_at
            `, { count: 'exact' })
            .eq('doctor_id', doctorProfile.id)
            .order('created_at', { ascending: false });

        if (patientName) query = query.ilike('patient_name', `%${patientName}%`);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: rxData, error: rxError, count } = await query;
        if (rxError) {
            const msg = (rxError.message || '').toLowerCase();
            if (msg.includes('does not exist') || rxError.code === '42P01' || rxError.code === 'PGRST205') {
                return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit) } });
            }
            throw new AppError('Failed to fetch prescriptions: ' + rxError.message, 500);
        }

        // Fetch items separately to avoid join issues
        const rxIds = (rxData || []).map(r => r.id);
        let itemsMap = {};
        if (rxIds.length > 0) {
            const { data: items } = await supabase
                .from('prescription_items')
                .select('prescription_id, medicine_name, dosage, morning, afternoon, night, duration_days')
                .in('prescription_id', rxIds);
            (items || []).forEach(it => {
                if (!itemsMap[it.prescription_id]) itemsMap[it.prescription_id] = [];
                itemsMap[it.prescription_id].push(it);
            });
        }

        const data = (rxData || []).map(rx => ({ ...rx, prescription_items: itemsMap[rx.id] || [] }));

        res.status(200).json({
            success: true,
            data,
            pagination: { total: count || 0, page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE QUEUE STATUS (start consultation, etc.)
// PATCH /api/doctor/queue/:queueId/status
// ─────────────────────────────────────────────────────────────────────────────
export async function updateQueueStatus(req, res, next) {
    const { queueId } = req.params;
    const { status } = req.body;

    try {
        const validStatuses = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'REFERRED'];
        if (!validStatuses.includes(status)) throw new AppError('Invalid status', 400);

        const update = { status, updated_at: new Date().toISOString() };
        if (status === 'IN_CONSULTATION') update.consulted_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('op_queue')
            .update(update)
            .eq('id', queueId)
            .eq('hospital_id', req.user.hospitalId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update status', 500);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ATTENDANCE HISTORY (for admin view)
// GET /api/doctor/attendance/history?doctorId=&from=&to=
// ─────────────────────────────────────────────────────────────────────────────
export async function getAttendanceHistory(req, res, next) {
    const { from, to, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        let query = supabase
            .from('doctor_attendance')
            .select('*', { count: 'exact' })
            .eq('doctor_id', doctorProfile.id)
            .order('attendance_date', { ascending: false });

        if (from) query = query.gte('attendance_date', from);
        if (to)   query = query.lte('attendance_date', to);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to fetch attendance history', 500);

        res.status(200).json({
            success: true,
            data: data || [],
            pagination: { total: count || 0, page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/doctor/leave-requests
export async function getMyLeaveRequests(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);
        const { data, error } = await supabase
            .from('doctor_leave_requests')
            .select('*')
            .eq('doctor_id', doctorProfile.id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw new AppError('Failed to fetch leave requests: ' + error.message, 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// POST /api/doctor/leave-requests
export async function applyDoctorLeave(req, res, next) {
    const { leaveDate, leaveType, reason } = req.body;
    try {
        if (!leaveDate) throw new AppError('Leave date is required', 400);
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        const { data: existing } = await supabase
            .from('doctor_leave_requests')
            .select('id')
            .eq('doctor_id', doctorProfile.id)
            .eq('leave_date', leaveDate)
            .eq('status', 'PENDING')
            .maybeSingle();
        if (existing) throw new AppError('Leave request already submitted for this date', 409);

        const { data, error } = await supabase
            .from('doctor_leave_requests')
            .insert({
                doctor_id: doctorProfile.id,
                hospital_id: doctorProfile.hospital_id,
                leave_date: leaveDate,
                leave_type: leaveType || 'CASUAL',
                reason: reason || null,
                status: 'PENDING',
                requested_by: req.user.id
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to apply leave: ' + error.message, 500);
        res.status(201).json({ success: true, message: 'Leave request submitted', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE CONSULT — GET/UPDATE PROFILE
// GET/PUT /api/doctor/online-consult/profile
// ─────────────────────────────────────────────────────────────────────────────
export async function getOnlineConsultProfile(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        const { data } = await supabase
            .from('online_consult_profiles')
            .select('*')
            .eq('doctor_id', doctorProfile.id)
            .maybeSingle();

        res.status(200).json({ success: true, data: data || null });
    } catch (error) {
        next(error);
    }
}

export async function updateOnlineConsultProfile(req, res, next) {
    const { isPublished, bio, consultationFee, availableDays, slotDurationMin, timeSlots, languages } = req.body;

    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        const payload = {};
        if (isPublished !== undefined) payload.is_published = isPublished;
        if (bio !== undefined) payload.bio = bio;
        if (consultationFee !== undefined) payload.consultation_fee = parseFloat(consultationFee);
        if (availableDays !== undefined) payload.available_days = availableDays;
        if (slotDurationMin !== undefined) payload.slot_duration_min = parseInt(slotDurationMin);
        if (timeSlots !== undefined) payload.time_slots = timeSlots;
        if (languages !== undefined) payload.languages = languages;

        const { data: existing } = await supabase
            .from('online_consult_profiles')
            .select('id')
            .eq('doctor_id', doctorProfile.id)
            .maybeSingle();

        let result;
        if (existing) {
            const { data } = await supabase
                .from('online_consult_profiles')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('doctor_id', doctorProfile.id)
                .select()
                .single();
            result = data;
        } else {
            const { data } = await supabase
                .from('online_consult_profiles')
                .insert({ ...payload, doctor_id: doctorProfile.id })
                .select()
                .single();
            result = data;
        }

        res.status(200).json({ success: true, message: 'Online consult profile updated', data: result });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET ALL DOCTOR ATTENDANCE (for admin dashboard)
// GET /api/hospital-admin/doctor-attendance
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalDoctorAttendance(req, res, next) {
    const { date } = req.query;
    const hospitalId = req.user.hospitalId;

    try {
        const queryDate = date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('doctor_attendance')
            .select(`
                *,
                doctor_profiles!doctor_attendance_doctor_id_fkey (
                    doctor_unique_id,
                    specialization,
                    users!doctor_profiles_user_id_fkey (
                        full_name, email
                    )
                )
            `)
            .eq('hospital_id', hospitalId)
            .eq('attendance_date', queryDate)
            .order('login_time', { ascending: true });

        if (error) throw new AppError('Failed to fetch attendance', 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET SCHEDULES
// GET /api/hospital-admin/doctor-schedules
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalSchedules(req, res, next) {
    const { date, doctorId } = req.query;
    const hospitalId = req.user.hospitalId;

    try {
        const queryDate = date || new Date().toISOString().split('T')[0];

        let query = supabase
            .from('doctor_schedules')
            .select(`
                *,
                doctor_profiles!doctor_schedules_doctor_id_fkey (
                    doctor_unique_id, specialization,
                    users!doctor_profiles_user_id_fkey (full_name)
                )
            `)
            .eq('hospital_id', hospitalId)
            .eq('schedule_date', queryDate)
            .eq('is_active', true)
            .order('shift_start');

        if (doctorId) query = query.eq('doctor_id', doctorId);

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch schedules', 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — CREATE DOCTOR SCHEDULE
// POST /api/hospital-admin/doctor-schedules
// ─────────────────────────────────────────────────────────────────────────────
export async function createDoctorSchedule(req, res, next) {
    const { doctorUserId, scheduleDate, dutyType, department, roomNumber, shiftStart, shiftEnd, notes } = req.body;
    const hospitalId = req.user.hospitalId;

    try {
        // Resolve doctor profile
        const { data: doctorProfile } = await supabase
            .from('doctor_profiles')
            .select('id')
            .eq('user_id', doctorUserId)
            .eq('hospital_id', hospitalId)
            .single();

        if (!doctorProfile) throw new AppError('Doctor not found in this hospital', 404);

        const { data, error } = await supabase
            .from('doctor_schedules')
            .insert({
                doctor_id: doctorProfile.id,
                hospital_id: hospitalId,
                assigned_by: req.user.id,
                schedule_date: scheduleDate,
                duty_type: dutyType || 'OP',
                department,
                room_number: roomNumber,
                shift_start: shiftStart,
                shift_end: shiftEnd,
                notes
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create schedule: ' + error.message, 500);

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'SCHEDULE_CREATED',
            entityType: 'doctor_schedules',
            entityId: data.id,
            ipAddress: req.ip,
            metadata: { doctorUserId, scheduleDate, dutyType }
        });

        res.status(201).json({ success: true, message: 'Schedule created', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — UPDATE RESOURCES
// PUT /api/hospital-admin/resources
// ─────────────────────────────────────────────────────────────────────────────
export async function updateHospitalResources(req, res, next) {
    const { generalBedsTotal, generalBedsAvailable, icuBedsTotal, icuBedsAvailable, ventilatorsTotal, ventilatorsAvailable } = req.body;
    const hospitalId = req.user.hospitalId;

    try {
        const payload = {
            general_beds_total: generalBedsTotal,
            general_beds_available: generalBedsAvailable,
            icu_beds_total: icuBedsTotal,
            icu_beds_available: icuBedsAvailable,
            ventilators_total: ventilatorsTotal,
            ventilators_available: ventilatorsAvailable,
            updated_by: req.user.id,
            updated_at: new Date().toISOString()
        };

        const { data: existing } = await supabase
            .from('hospital_resources')
            .select('id')
            .eq('hospital_id', hospitalId)
            .maybeSingle();

        let data;
        if (existing) {
            const res_ = await supabase
                .from('hospital_resources')
                .update(payload)
                .eq('hospital_id', hospitalId)
                .select()
                .single();
            data = res_.data;
        } else {
            const res_ = await supabase
                .from('hospital_resources')
                .insert({ ...payload, hospital_id: hospitalId })
                .select()
                .single();
            data = res_.data;
        }

        res.status(200).json({ success: true, message: 'Resources updated', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — CREATE ADMIN NOTICE
// POST /api/hospital-admin/notices
// ─────────────────────────────────────────────────────────────────────────────
export async function createAdminNotice(req, res, next) {
    const { title, message, priority, expiresAt } = req.body;
    const hospitalId = req.user.hospitalId;

    try {
        const { data, error } = await supabase
            .from('admin_notices')
            .insert({
                hospital_id: hospitalId,
                created_by: req.user.id,
                title,
                message,
                priority: priority || 'NORMAL',
                expires_at: expiresAt || null
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create notice: ' + error.message, 500);

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR / STAFF — GET LATEST NOTICES (for polling)
// GET /api/doctor/notices
// ─────────────────────────────────────────────────────────────────────────────
export async function getLatestNotices(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data } = await supabase
            .from('admin_notices')
            .select('id, title, message, priority, created_at')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order('created_at', { ascending: false })
            .limit(10);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET STAFF LIVE STATUS
// GET /api/hospital-admin/staff-status
// ─────────────────────────────────────────────────────────────────────────────
export async function getStaffLiveStatus(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const today = new Date().toISOString().split('T')[0];

        // All active staff
        const { data: staffList } = await supabase
            .from('staff_profiles')
            .select('id, full_name, staff_role, department, user_id')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .eq('is_deleted', false);

        if (!staffList?.length) return res.status(200).json({ success: true, data: [] });

        // Doctor profiles
        const doctorUserIds = staffList.filter(s => s.staff_role === 'DOCTOR').map(s => s.user_id);
        const doctorProfileMap = {};
        if (doctorUserIds.length > 0) {
            const { data: dps } = await supabase
                .from('doctor_profiles')
                .select('id, user_id, doctor_unique_id')
                .in('user_id', doctorUserIds);
            (dps || []).forEach(dp => { doctorProfileMap[dp.user_id] = dp; });
        }

        // Today's attendance
        const doctorProfileIds = Object.values(doctorProfileMap).map(dp => dp.id);
        const attendanceMap = {};
        if (doctorProfileIds.length > 0) {
            const { data: attData } = await supabase
                .from('doctor_attendance')
                .select('doctor_id, status, login_time, logout_time')
                .in('doctor_id', doctorProfileIds)
                .eq('attendance_date', today);
            (attData || []).forEach(att => { attendanceMap[att.doctor_id] = att; });
        }

        // Who is currently attending a patient
        const attendingSet = new Set();
        if (doctorProfileIds.length > 0) {
            const { data: queueData } = await supabase
                .from('op_queue')
                .select('doctor_id, patient_name')
                .in('doctor_id', doctorProfileIds)
                .eq('queue_date', today)
                .eq('status', 'IN_CONSULTATION');
            (queueData || []).forEach(q => attendingSet.add(q.doctor_id));
        }

        // Queue counts per doctor
        const queueCountMap = {};
        if (doctorProfileIds.length > 0) {
            const { data: qc } = await supabase
                .from('op_queue')
                .select('doctor_id, status')
                .in('doctor_id', doctorProfileIds)
                .eq('queue_date', today);
            (qc || []).forEach(q => {
                if (!queueCountMap[q.doctor_id]) queueCountMap[q.doctor_id] = { total: 0, waiting: 0, completed: 0 };
                queueCountMap[q.doctor_id].total++;
                if (q.status === 'WAITING') queueCountMap[q.doctor_id].waiting++;
                if (q.status === 'COMPLETED') queueCountMap[q.doctor_id].completed++;
            });
        }

        const result = staffList.map(staff => {
            const dp = doctorProfileMap[staff.user_id];
            const att = dp ? attendanceMap[dp.id] : null;
            const isAttending = dp ? attendingSet.has(dp.id) : false;
            const qc = dp ? (queueCountMap[dp.id] || {}) : {};

            let status = 'OFFLINE';
            if (att?.login_time) {
                if (isAttending) status = 'ATTENDING_PATIENT';
                else if (att.status === 'ON_BREAK') status = 'ON_BREAK';
                else if (att.logout_time) status = 'CHECKED_OUT';
                else status = 'ON_DUTY';
            }

            return {
                staffId: staff.id,
                userId: staff.user_id,
                fullName: staff.full_name,
                role: staff.staff_role,
                department: staff.department,
                doctorUniqueId: dp?.doctor_unique_id || null,
                status,
                loginTime: att?.login_time || null,
                logoutTime: att?.logout_time || null,
                queueTotal: qc.total || 0,
                queueWaiting: qc.waiting || 0,
                queueCompleted: qc.completed || 0,
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — SEND STAFF MESSAGE
// POST /api/hospital-admin/messages
// ─────────────────────────────────────────────────────────────────────────────
export async function sendStaffMessage(req, res, next) {
    const { targetType, targetUserId, targetRole, title, message, priority } = req.body;
    const hospitalId = req.user.hospitalId;
    try {
        if (!title || !message) throw new AppError('Title and message are required', 400);

        const { data: sender } = await supabase
            .from('users').select('full_name').eq('id', req.user.id).single();

        const { data, error } = await supabase
            .from('staff_messages')
            .insert({
                hospital_id: hospitalId,
                sender_id: req.user.id,
                sender_name: sender?.full_name || 'Admin',
                target_type: targetType || 'ALL',
                target_user_id: targetUserId || null,
                target_role: targetRole || null,
                title,
                message,
                priority: priority || 'NORMAL'
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to send message: ' + error.message, 500);

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'MESSAGE_SENT',
            entityType: 'staff_messages',
            entityId: data.id,
            ipAddress: req.ip,
            metadata: { targetType, targetRole, title }
        });

        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET SENT MESSAGES
// GET /api/hospital-admin/messages
// ─────────────────────────────────────────────────────────────────────────────
export async function getAdminSentMessages(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        if (!hospitalId) {
            return res.status(200).json({ success: true, data: [] });
        }

        const { data, error } = await supabase
            .from('staff_messages')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            const msg = (error.message || '').toLowerCase();
            const code = error.code || '';
            const schemaNotReady =
                code === '42P01' || code === '42703' || code === 'PGRST205' ||
                msg.includes('does not exist') ||
                msg.includes('staff_messages');

            if (schemaNotReady) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    warning: 'Messaging module not initialized yet'
                });
            }
            throw new AppError('Failed to fetch messages: ' + error.message, 500);
        }

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR / STAFF — GET MY MESSAGES
// GET /api/doctor/messages
// ─────────────────────────────────────────────────────────────────────────────
export async function getMyMessages(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const userId     = req.user.id;
    const userRole   = req.user.role;
    try {
        const [{ data: allMsgs }, { data: roleMsgs }, { data: indMsgs }] = await Promise.all([
            supabase.from('staff_messages').select('*')
                .eq('hospital_id', hospitalId).eq('target_type', 'ALL')
                .order('created_at', { ascending: false }).limit(20),
            supabase.from('staff_messages').select('*')
                .eq('hospital_id', hospitalId).eq('target_type', 'ROLE').eq('target_role', userRole)
                .order('created_at', { ascending: false }).limit(20),
            supabase.from('staff_messages').select('*')
                .eq('hospital_id', hospitalId).eq('target_type', 'INDIVIDUAL').eq('target_user_id', userId)
                .order('created_at', { ascending: false }).limit(20),
        ]);

        const merged = [...(allMsgs||[]), ...(roleMsgs||[]), ...(indMsgs||[])]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);

        // Read receipts
        const ids = merged.map(m => m.id);
        const readSet = new Set();
        if (ids.length > 0) {
            const { data: reads } = await supabase
                .from('staff_message_reads')
                .select('message_id')
                .eq('user_id', userId)
                .in('message_id', ids);
            (reads || []).forEach(r => readSet.add(r.message_id));
        }

        const result = merged.map(m => ({ ...m, isRead: readSet.has(m.id) }));
        const unreadCount = result.filter(m => !m.isRead).length;

        res.status(200).json({ success: true, data: result, unreadCount });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR / STAFF — MARK MESSAGE READ
// PATCH /api/doctor/messages/:msgId/read
// ─────────────────────────────────────────────────────────────────────────────
export async function markMessageRead(req, res, next) {
    const { msgId } = req.params;
    const userId = req.user.id;
    try {
        await supabase.from('staff_message_reads')
            .upsert({ message_id: msgId, user_id: userId, read_at: new Date().toISOString() },
                    { onConflict: 'message_id,user_id' });
        res.status(200).json({ success: true });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET DOCTOR LIST (for schedule assignment)
// GET /api/hospital-admin/doctors
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalDoctors(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data, error } = await supabase
            .from('staff_profiles')
            .select('user_id, full_name, department')
            .eq('hospital_id', hospitalId)
            .eq('staff_role', 'DOCTOR')
            .eq('is_active', true)
            .eq('is_deleted', false);
        if (error) throw new AppError('Failed to fetch doctors', 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — DELETE SCHEDULE
// DELETE /api/hospital-admin/doctor-schedules/:scheduleId
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteDoctorSchedule(req, res, next) {
    const { scheduleId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        const { error } = await supabase
            .from('doctor_schedules')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', scheduleId)
            .eq('hospital_id', hospitalId);
        if (error) throw new AppError('Failed to delete schedule', 500);
        res.status(200).json({ success: true, message: 'Schedule removed' });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — GET ALL NOTICES
// GET /api/hospital-admin/notices
// ─────────────────────────────────────────────────────────────────────────────
export async function getAdminNotices(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data, error } = await supabase
            .from('admin_notices')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw new AppError('Failed to fetch notices', 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN — DELETE NOTICE
// DELETE /api/hospital-admin/notices/:noticeId
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteAdminNotice(req, res, next) {
    const { noticeId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        await supabase.from('admin_notices')
            .update({ is_active: false })
            .eq('id', noticeId)
            .eq('hospital_id', hospitalId);
        res.status(200).json({ success: true });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR — GET LAB NOTIFICATIONS (completed results not yet seen)
// GET /api/doctor/lab-notifications
// Doctor polls this to know when a lab result is ready for their patient.
// Marks them as notified after fetching.
// ─────────────────────────────────────────────────────────────────────────────
export async function getDoctorLabNotifications(req, res, next) {
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        // Fetch completed lab requests for this doctor that haven't been notified
        const { data: pending, error } = await supabase
            .from('lab_requests')
            .select('id, patient_name, test_type, result_notes, result_url, completed_at, urgency')
            .eq('doctor_id', doctorProfile.id)
            .eq('hospital_id', req.user.hospitalId)
            .eq('status', 'COMPLETED')
            .eq('notified', false)
            .order('completed_at', { ascending: false })
            .limit(20);

        if (error) throw new AppError('Failed to fetch lab notifications', 500);

        // Also get the running count of all pending lab requests for this doctor
        const { count: pendingCount } = await supabase
            .from('lab_requests')
            .select('id', { count: 'exact', head: true })
            .eq('doctor_id', doctorProfile.id)
            .eq('hospital_id', req.user.hospitalId)
            .eq('status', 'PENDING');

        // Mark fetched notifications as notified
        if (pending && pending.length > 0) {
            const ids = pending.map(n => n.id);
            await supabase
                .from('lab_requests')
                .update({ notified: true, updated_at: new Date().toISOString() })
                .in('id', ids);
        }

        res.status(200).json({
            success: true,
            data: pending || [],
            pendingLabCount: pendingCount || 0,
            newResultsCount: (pending || []).length
        });
    } catch (error) { next(error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR — GET ALL MY LAB REQUESTS
// GET /api/doctor/lab-requests?status=&patientName=
// ─────────────────────────────────────────────────────────────────────────────
export async function getDoctorLabRequests(req, res, next) {
    const { status, patientName, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const doctorProfile = await resolveDoctorProfile(req.user.id);

        let query = supabase
            .from('lab_requests')
            .select('*', { count: 'exact' })
            .eq('doctor_id', doctorProfile.id)
            .eq('hospital_id', req.user.hospitalId)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') query = query.eq('status', status.toUpperCase());
        if (patientName) query = query.ilike('patient_name', `%${patientName}%`);
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
// HOSPITAL ADMIN — GET BED STATISTICS OVERVIEW
// GET /api/hospital-admin/bed-stats
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalBedStats(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data: beds, error } = await supabase
            .from('beds')
            .select('status, ward_id')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true);

        if (error) {
            const msg = (error.message || '').toLowerCase();
            const code = error.code || '';
            const isMissing = code === '42P01' || code === '42703' || code === 'PGRST205' ||
                msg.includes('does not exist') || msg.includes('relation');
            if (isMissing) return res.status(200).json({ success: true, data: { total:0, available:0, occupied:0, cleaning:0, maintenance:0, occupancyRate:0, byWard:[] }, warning: 'Bed tables not yet created. Run migration 004.' });
            throw new AppError('Failed to fetch bed stats', 500);
        }

        // Fetch wards for ward-wise breakdown
        const { data: wards } = await supabase
            .from('wards')
            .select('id, ward_name, ward_type')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true);

        const bedsByWard = {};
        (beds || []).forEach(b => {
            if (!bedsByWard[b.ward_id]) bedsByWard[b.ward_id] = { total:0, available:0, occupied:0, cleaning:0, maintenance:0 };
            bedsByWard[b.ward_id].total++;
            if (b.status === 'AVAILABLE')   bedsByWard[b.ward_id].available++;
            if (b.status === 'OCCUPIED')    bedsByWard[b.ward_id].occupied++;
            if (b.status === 'CLEANING')    bedsByWard[b.ward_id].cleaning++;
            if (b.status === 'MAINTENANCE') bedsByWard[b.ward_id].maintenance++;
        });

        const byWard = (wards || []).map(w => ({
            wardId: w.id, wardName: w.ward_name, wardType: w.ward_type,
            ...(bedsByWard[w.id] || { total:0, available:0, occupied:0, cleaning:0, maintenance:0 })
        }));

        const stats = {
            total: (beds || []).length,
            available: (beds || []).filter(b => b.status === 'AVAILABLE').length,
            occupied:  (beds || []).filter(b => b.status === 'OCCUPIED').length,
            cleaning:  (beds || []).filter(b => b.status === 'CLEANING').length,
            maintenance: (beds || []).filter(b => b.status === 'MAINTENANCE').length,
            byWard
        };
        stats.occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

        res.status(200).json({ success: true, data: stats });
    } catch (error) { next(error); }
}
