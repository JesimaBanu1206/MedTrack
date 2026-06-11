/**
 * appointmentController.js
 * Patient appointment booking — patient ID verification, slot booking, online consult
 * Appointments booked here → appear in receptionist dashboard (in-person)
 *                          → appear in doctor dashboard (online)
 */

import supabase from '../config/supabase.js';
import { sendAppointmentConfirmationEmail } from '../config/mailer.js';
import { AppError } from '../utils/errors.js';

const normalizePatientId = (value = '') => {
    const v = String(value).trim().toUpperCase();
    if (!v) return '';
    if (/^\d+$/.test(v)) return `MT-${v}`;
    if (/^MT\d+$/.test(v)) return `MT-${v.slice(2)}`;
    return v;
};

const buildPatientIdVariants = (value = '') => {
    const normalized = normalizePatientId(value);
    if (!normalized) return [];

    const variants = new Set([normalized]);
    if (normalized.startsWith('MT-')) {
        const numeric = normalized.slice(3);
        if (numeric) {
            variants.add(numeric);
            variants.add(`MT${numeric}`);
        }
    } else if (/^MT\d+$/.test(normalized)) {
        const numeric = normalized.slice(2);
        variants.add(`MT-${numeric}`);
        variants.add(numeric);
    } else if (/^\d+$/.test(normalized)) {
        variants.add(`MT-${normalized}`);
        variants.add(`MT${normalized}`);
    }

    return Array.from(variants);
};

const normalizeClockTime = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;

    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
        let hour = Number(ampm[1]);
        const min = Number(ampm[2]);
        const meridian = ampm[3].toUpperCase();
        if (meridian === 'PM' && hour < 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    }

    return raw;
};

const firstRow = (rows) => (Array.isArray(rows) && rows.length > 0 ? rows[0] : null);

async function resolveHospitalName(hospitalId) {
    if (!hospitalId) return null;
    const { data } = await supabase
        .from('hospitals')
        .select('hospital_name')
        .eq('id', hospitalId)
        .maybeSingle();
    return data?.hospital_name || null;
}

async function resolvePatientContact(patient) {
    let email = patient?.email || null;
    let phone = patient?.phone || null;
    let fullName = patient?.full_name || null;

    if ((!email || !phone || !fullName) && patient?.user_id) {
        const { data: user } = await supabase
            .from('users')
            .select('email, phone, full_name')
            .eq('id', patient.user_id)
            .maybeSingle();

        email = email || user?.email || null;
        phone = phone || user?.phone || null;
        fullName = fullName || user?.full_name || null;
    }

    return { email, phone, fullName };
}

async function sendAppointmentEmailSafe(payload) {
    if (!payload?.to) return;
    try {
        await sendAppointmentConfirmationEmail(payload);
    } catch (error) {
        console.warn('Appointment confirmation email skipped:', error?.message || error);
    }
}

async function resolveDoctorIdentity({ doctorId, doctorName, department }) {
    let doctorProfileId = null;
    let doctorUserId = null;
    let doctorLabel = doctorName || null;
    let hospitalId = null;

    if (doctorId) {
        const { data: profileById } = await supabase
            .from('doctor_profiles')
            .select('id, user_id, hospital_id')
            .eq('id', doctorId)
            .maybeSingle();

        if (profileById) {
            doctorProfileId = profileById.id;
            doctorUserId = profileById.user_id || null;
            hospitalId = profileById.hospital_id || null;
        } else {
            const { data: profileByUser } = await supabase
                .from('doctor_profiles')
                .select('id, user_id, hospital_id')
                .eq('user_id', doctorId)
                .maybeSingle();
            if (profileByUser) {
                doctorProfileId = profileByUser.id;
                doctorUserId = profileByUser.user_id || null;
                hospitalId = profileByUser.hospital_id || null;
            } else {
                doctorUserId = doctorId;
            }
        }
    }

    if (!doctorUserId && doctorName) {
        const { data: staffByName } = await supabase
            .from('staff_profiles')
            .select('user_id, full_name, hospital_id')
            .eq('staff_role', 'DOCTOR')
            .ilike('full_name', `%${doctorName}%`)
            .limit(1);
        const staff = firstRow(staffByName);
        if (staff?.user_id) {
            doctorUserId = staff.user_id;
            doctorLabel = staff.full_name || doctorLabel;
            hospitalId = staff.hospital_id || hospitalId;
        }
    }

    if (!doctorUserId && department) {
        const { data: staffByDept } = await supabase
            .from('staff_profiles')
            .select('user_id, full_name, hospital_id')
            .eq('staff_role', 'DOCTOR')
            .ilike('department', `%${department}%`)
            .eq('is_active', true)
            .limit(1);
        const staff = firstRow(staffByDept);
        if (staff?.user_id) {
            doctorUserId = staff.user_id;
            doctorLabel = staff.full_name || doctorLabel;
            hospitalId = staff.hospital_id || hospitalId;
        }
    }

    if (!doctorProfileId && doctorUserId) {
        const { data: profile } = await supabase
            .from('doctor_profiles')
            .select('id, user_id, hospital_id')
            .eq('user_id', doctorUserId)
            .maybeSingle();
        if (profile) {
            doctorProfileId = profile.id;
            hospitalId = hospitalId || profile.hospital_id || null;
        }
    }

    if (!doctorLabel && doctorUserId) {
        const { data: user } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', doctorUserId)
            .maybeSingle();
        doctorLabel = user?.full_name || null;
    }

    return { doctorProfileId, doctorUserId, doctorLabel: doctorLabel || doctorName || 'Doctor', hospitalId };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY PATIENT EXISTS
// GET /api/appointments/verify-patient?pid=
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyPatient(req, res, next) {
    const { pid } = req.query;
    try {
        if (!pid) throw new AppError('Patient ID is required', 400);
        const patientIdVariants = buildPatientIdVariants(pid);
        if (!patientIdVariants.length) throw new AppError('Patient ID is required', 400);

        const { data, error } = await supabase
            .from('patients')
            .select('id, patient_pid, full_name, age, gender, phone, blood_group, address')
            .in('patient_pid', patientIdVariants)
            .limit(1);

        if (error) throw new AppError('Database lookup failed', 500);
        const patient = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (!patient) {
            return res.status(200).json({
                success: false,
                found: false,
                message: 'Patient ID not found. Please register first at the hospital.',
            });
        }

        return res.status(200).json({ success: true, found: true, data: patient });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DISTINCT CITIES FROM HOSPITALS
// GET /api/appointments/cities
// ─────────────────────────────────────────────────────────────────────────────
export async function getCities(req, res, next) {
    try {
        const { data, error } = await supabase
            .from('hospitals')
            .select('district')
            .eq('is_active', true);

        if (error) throw new AppError('Failed to fetch cities', 500);

        const cities = [...new Set((data || []).map(h => h.district).filter(Boolean))].sort();
        return res.status(200).json({ success: true, data: cities });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET HOSPITALS BY CITY/DISTRICT
// GET /api/appointments/hospitals?city=
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalsByCity(req, res, next) {
    const { city } = req.query;
    try {
        let query = supabase
            .from('hospitals')
            .select('id, hospital_name, type, district, address, is_active')
            .eq('is_active', true)
            .order('hospital_name');

        if (city) query = query.ilike('district', `%${city}%`);

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch hospitals', 500);

        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET OP TIMINGS (live — receptionist changes reflect here immediately)
// GET /api/appointments/op-timings?hospital_id=&date=
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalOpTimings(req, res, next) {
    const { hospital_id, date } = req.query;
    try {
        if (!hospital_id) throw new AppError('hospital_id is required', 400);

        const queryDate = date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('op_timings')
            .select('id, department, start_time, end_time, slot_duration_minutes, max_patients, doctor_name, notes, timing_date')
            .eq('hospital_id', hospital_id)
            .eq('timing_date', queryDate)
            .eq('is_active', true);

        if (error) throw new AppError('Failed to fetch OP timings', 500);

        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK IN-PERSON OP APPOINTMENT
// POST /api/appointments/book
// → Appears in receptionist dashboard after booking
// ─────────────────────────────────────────────────────────────────────────────
export async function bookAppointment(req, res, next) {
    const {
        patientPid, hospitalId, department, visitDate,
        preferredTime, purpose, consultationType,
    } = req.body;

    try {
        if (!patientPid || !department || !visitDate) {
            throw new AppError('patientPid, department, and visitDate are required', 400);
        }

        const consultationTypeNormalized = String(consultationType || 'IN_PERSON').toUpperCase();
        if (consultationTypeNormalized === 'IN_PERSON' && !hospitalId) {
            throw new AppError('hospitalId is required for in-person appointments', 400);
        }

        const normalizedPatientPid = normalizePatientId(patientPid);
        const patientIdVariants = buildPatientIdVariants(normalizedPatientPid);
        if (!patientIdVariants.length) throw new AppError('patientPid is required', 400);

        const { data: patientRows, error: patErr } = await supabase
            .from('patients')
            .select('id, patient_pid, full_name, age, gender, phone, email, user_id')
            .in('patient_pid', patientIdVariants)
            .limit(1);

        if (patErr) throw new AppError('Patient lookup failed', 500);
        const patient = firstRow(patientRows);
        if (!patient) throw new AppError('Patient not found. Please register first.', 404);
        const canonicalPatientPid = patient.patient_pid || normalizedPatientPid;

        const resolvedHospitalId = hospitalId || null;

        if (resolvedHospitalId) {
            const { data: existing } = await supabase
                .from('op_queue')
                .select('id, token_number')
                .eq('hospital_id', resolvedHospitalId)
                .eq('patient_pid', canonicalPatientPid)
                .eq('visit_date', visitDate)
                .eq('department', department)
                .neq('status', 'CANCELLED')
                .maybeSingle();

            if (existing) {
                return res.status(200).json({
                    success: true,
                    alreadyBooked: true,
                    data: { ...existing, tokenNumber: existing.token_number },
                    message: `Already booked. Your token: #${existing.token_number}`,
                });
            }
        }

        const { count } = await supabase
            .from('op_queue')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', resolvedHospitalId)
            .eq('visit_date', visitDate)
            .eq('department', department)
            .neq('status', 'CANCELLED');

        const tokenNumber = (count || 0) + 1;
        const estimatedWaitMinutes = (count || 0) * 15;

        let opTiming = null;
        if (resolvedHospitalId) {
            const { data: timing } = await supabase
                .from('op_timings')
                .select('start_time, end_time, slot_duration_minutes')
                .eq('hospital_id', resolvedHospitalId)
                .eq('timing_date', visitDate)
                .eq('department', department)
                .maybeSingle();
            opTiming = timing;
        }

        const { data: queueEntry, error: qErr } = await supabase
            .from('op_queue')
            .insert({
                hospital_id: resolvedHospitalId,
                patient_id: patient.id,
                patient_pid: canonicalPatientPid,
                patient_name: patient.full_name,
                age: patient.age,
                gender: patient.gender,
                department,
                reason: purpose || 'Consultation',
                token_number: tokenNumber,
                status: 'WAITING',
                triage_status: 'NORMAL',
                visit_date: visitDate,
                preferred_time: preferredTime || null,
                consultation_type: consultationTypeNormalized,
                booked_online: consultationTypeNormalized === 'ONLINE',
            })
            .select()
            .single();

        if (qErr) throw new AppError('Booking failed: ' + qErr.message, 500);

        const [contact, hospitalName] = await Promise.all([
            resolvePatientContact(patient),
            resolveHospitalName(resolvedHospitalId)
        ]);

        await sendAppointmentEmailSafe({
            to: contact.email,
            patientName: contact.fullName || patient.full_name,
            patientPid: canonicalPatientPid,
            appointmentType: consultationTypeNormalized,
            hospitalName,
            department,
            visitDate,
            visitTime: preferredTime || null,
            tokenNumber,
        });

        return res.status(201).json({
            success: true,
            data: {
                ...queueEntry,
                tokenNumber,
                estimatedWaitMinutes,
                opStartTime: opTiming?.start_time || '08:00',
                slotDuration: opTiming?.slot_duration_minutes || 15,
            },
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK ONLINE CONSULTATION
// POST /api/appointments/book-online
// → Appears in doctor dashboard after booking
// ─────────────────────────────────────────────────────────────────────────────
export async function bookOnlineConsultation(req, res, next) {
    const { patientPid, department, doctorName, doctorId, bookingDate, bookingTime, fee } = req.body;
    try {
        if (!patientPid || !department || !bookingDate || !bookingTime) {
            throw new AppError('patientPid, department, bookingDate, bookingTime are required', 400);
        }

        const normalizedPatientPid = normalizePatientId(patientPid);
        const patientIdVariants = buildPatientIdVariants(normalizedPatientPid);
        if (!patientIdVariants.length) throw new AppError('patientPid is required', 400);

        const { data: patientRows, error: patientErr } = await supabase
            .from('patients')
            .select('id, patient_pid, full_name, age, gender, phone, email, user_id')
            .in('patient_pid', patientIdVariants)
            .limit(1);

        if (patientErr) throw new AppError('Patient lookup failed', 500);
        const patient = firstRow(patientRows);
        if (!patient) throw new AppError('Patient not found', 404);
        const canonicalPatientPid = patient.patient_pid || normalizedPatientPid;

        const resolvedFee = Number.isFinite(Number(fee)) ? Number(fee) : 200;
        const normalizedBookingTime = normalizeClockTime(bookingTime);

        const doctorIdentity = await resolveDoctorIdentity({ doctorId, doctorName, department });
        const onlineReason = `Online consultation with ${doctorIdentity.doctorLabel || doctorName || 'doctor'}`;

        let result = null;
        let usedOnlineBookingsTable = false;

        try {
            const { data, error } = await supabase
                .from('online_consult_bookings')
                .insert({
                    hospital_id: doctorIdentity.hospitalId || null,
                    doctor_id: doctorIdentity.doctorProfileId || null,
                    patient_id: patient.id,
                    patient_name: patient.full_name,
                    patient_phone: patient.phone || null,
                    appointment_date: bookingDate,
                    appointment_time: normalizedBookingTime || bookingTime,
                    reason: onlineReason,
                    status: 'SCHEDULED',
                    fee: resolvedFee,
                })
                .select()
                .single();

            if (error) throw error;
            result = {
                ...data,
                booking_date: data?.appointment_date || bookingDate,
                booking_time: data?.appointment_time || bookingTime,
                fee: data?.fee ?? resolvedFee,
                doctor_name: doctorIdentity.doctorLabel,
            };
            usedOnlineBookingsTable = true;
        } catch {
            try {
                const { data, error } = await supabase
                    .from('online_consult_bookings')
                    .insert({
                        hospital_id: doctorIdentity.hospitalId || null,
                        doctor_id: doctorIdentity.doctorUserId || doctorIdentity.doctorProfileId || null,
                        patient_id: patient.id,
                        patient_pid: canonicalPatientPid,
                        patient_name: patient.full_name,
                        department,
                        booking_date: bookingDate,
                        booking_time: bookingTime,
                        fee: resolvedFee,
                        status: 'PENDING',
                        notes: onlineReason,
                    })
                    .select()
                    .single();

                if (error) throw error;
                result = {
                    ...data,
                    booking_date: data?.booking_date || bookingDate,
                    booking_time: data?.booking_time || bookingTime,
                    fee: data?.fee ?? resolvedFee,
                    doctor_name: doctorIdentity.doctorLabel,
                };
                usedOnlineBookingsTable = true;
            } catch {
                const { count } = await supabase
                    .from('op_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('visit_date', bookingDate)
                    .eq('department', department)
                    .eq('consultation_type', 'ONLINE');

                const { data, error: qErr } = await supabase
                    .from('op_queue')
                    .insert({
                        hospital_id: doctorIdentity.hospitalId || null,
                        patient_id: patient.id,
                        patient_pid: canonicalPatientPid,
                        patient_name: patient.full_name,
                        age: patient.age,
                        gender: patient.gender,
                        department,
                        doctor_id: doctorIdentity.doctorProfileId || doctorIdentity.doctorUserId || null,
                        reason: onlineReason,
                        token_number: (count || 0) + 1,
                        status: 'WAITING',
                        triage_status: 'NORMAL',
                        visit_date: bookingDate,
                        preferred_time: bookingTime,
                        consultation_type: 'ONLINE',
                        booked_online: true,
                    })
                    .select()
                    .single();

                if (qErr) throw new AppError('Booking failed: ' + qErr.message, 500);
                result = {
                    ...data,
                    booking_date: bookingDate,
                    booking_time: bookingTime,
                    fee: resolvedFee,
                    doctor_name: doctorIdentity.doctorLabel,
                };
            }
        }

        const [contact, hospitalName] = await Promise.all([
            resolvePatientContact(patient),
            resolveHospitalName(result?.hospital_id || doctorIdentity.hospitalId)
        ]);

        await sendAppointmentEmailSafe({
            to: contact.email,
            patientName: contact.fullName || patient.full_name,
            patientPid: canonicalPatientPid,
            appointmentType: 'ONLINE',
            hospitalName,
            department,
            visitDate: bookingDate,
            visitTime: bookingTime,
            doctorName: doctorIdentity.doctorLabel,
            fee: result?.fee ?? resolvedFee,
        });

        return res.status(201).json({
            success: true,
            source: usedOnlineBookingsTable ? 'online_consult_bookings' : 'op_queue',
            data: result,
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PATIENT'S APPOINTMENTS
// GET /api/appointments/my?pid=
// ─────────────────────────────────────────────────────────────────────────────
export async function getPatientAppointments(req, res, next) {
    const { pid } = req.query;
    try {
        if (!pid) throw new AppError('Patient ID required', 400);
        const patientIdVariants = buildPatientIdVariants(pid);
        if (!patientIdVariants.length) throw new AppError('Patient ID required', 400);

        const { data, error } = await supabase
            .from('op_queue')
            .select(`
                id, token_number, department, status, visit_date,
                preferred_time, consultation_type, reason, triage_status,
                hospitals (hospital_name, district, address)
            `)
            .in('patient_pid', patientIdVariants)
            .order('visit_date', { ascending: false })
            .limit(20);

        if (error) throw new AppError('Failed to fetch appointments', 500);

        return res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}


