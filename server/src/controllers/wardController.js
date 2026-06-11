/**
 * wardController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ward & Bed management — Hospital Admin + Doctor IP ward view
 * All queries strictly scoped to hospitalId.
 */

import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { createActivityLog } from '../utils/activityLogger.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — build bed code
// ─────────────────────────────────────────────────────────────────────────────
function buildBedCode(hospitalCode, wardName, bedNumber) {
    const hc = (hospitalCode || 'HOSP').replace(/\s+/g, '').toUpperCase().slice(0, 8);
    const wn = wardName.replace(/\s+/g, '').toUpperCase().slice(0, 8);
    const bn = String(bedNumber).padStart(2, '0');
    return `${hc}-${wn}-${bn}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — WARD CRUD
// ══════════════════════════════════════════════════════════════════════════════

// Helper: check if error means table/column doesn't exist yet (migration not run)
function isMissingTableError(err) {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.code || '';
    return code === '42P01' || code === '42703' || code === 'PGRST205' ||
        msg.includes('does not exist') || msg.includes('relation') || msg.includes('undefined_table');
}

// GET /api/hospital-admin/wards
export async function getWards(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data, error } = await supabase
            .from('wards')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('ward_name');

        if (error) {
            if (isMissingTableError(error)) return res.status(200).json({ success: true, data: [], warning: 'Ward tables not yet created. Run migration 004.' });
            throw new AppError('Failed to fetch wards: ' + error.message, 500);
        }

        // Append bed stats
        const wardIds = (data || []).map(w => w.id);
        let bedStats = {};
        if (wardIds.length > 0) {
            const { data: beds } = await supabase
                .from('beds')
                .select('ward_id, status')
                .in('ward_id', wardIds)
                .eq('is_active', true);
            (beds || []).forEach(b => {
                if (!bedStats[b.ward_id]) bedStats[b.ward_id] = { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
                bedStats[b.ward_id].total++;
                if (b.status === 'AVAILABLE') bedStats[b.ward_id].available++;
                if (b.status === 'OCCUPIED')  bedStats[b.ward_id].occupied++;
                if (b.status === 'CLEANING')  bedStats[b.ward_id].cleaning++;
                if (b.status === 'MAINTENANCE') bedStats[b.ward_id].maintenance++;
            });
        }
        const result = (data || []).map(w => ({ ...w, bedStats: bedStats[w.id] || { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 } }));
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}

// POST /api/hospital-admin/wards
export async function createWard(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const { wardName, wardType, totalBeds, floorNumber, notes } = req.body;
    try {
        if (!wardName || !totalBeds) throw new AppError('Ward name and total beds are required', 400);
        // Verify table exists
        const { error: tblCheck } = await supabase.from('wards').select('id').limit(1);
        if (tblCheck && isMissingTableError(tblCheck)) throw new AppError('Ward module not initialized. Please run database migration 004 first.', 503);

        // Fetch hospital code for bed naming
        const { data: hospital } = await supabase
            .from('hospitals')
            .select('hospital_code, hospital_name')
            .eq('id', hospitalId)
            .single();

        const { data: ward, error: wardErr } = await supabase
            .from('wards')
            .insert({ hospital_id: hospitalId, ward_name: wardName, ward_type: wardType || 'GENERAL',
                total_beds: parseInt(totalBeds), floor_number: floorNumber || null, notes })
            .select()
            .single();
        if (wardErr) throw new AppError('Failed to create ward: ' + wardErr.message, 500);

        // Auto-create beds
        const beds = [];
        for (let i = 1; i <= parseInt(totalBeds); i++) {
            beds.push({
                hospital_id: hospitalId,
                ward_id: ward.id,
                bed_code: buildBedCode(hospital?.hospital_code || hospital?.hospital_name, wardName, i),
                bed_number: i,
                status: 'AVAILABLE'
            });
        }
        if (beds.length > 0) {
            const { error: bedErr } = await supabase.from('beds').insert(beds);
            if (bedErr) console.warn('Bed creation warning:', bedErr.message);
        }

        await createActivityLog({
            hospitalId, userId: req.user.id, action: 'WARD_CREATED',
            entityType: 'wards', entityId: ward.id, ipAddress: req.ip,
            metadata: { wardName, wardType, totalBeds }
        });

        res.status(201).json({ success: true, message: 'Ward created with beds', data: ward });
    } catch (error) { next(error); }
}

// PUT /api/hospital-admin/wards/:wardId
export async function updateWard(req, res, next) {
    const { wardId } = req.params;
    const hospitalId = req.user.hospitalId;
    const { wardName, wardType, floorNumber, notes, isActive } = req.body;
    try {
        const updates = { updated_at: new Date().toISOString() };
        if (wardName  !== undefined) updates.ward_name   = wardName;
        if (wardType  !== undefined) updates.ward_type   = wardType;
        if (floorNumber !== undefined) updates.floor_number = floorNumber;
        if (notes     !== undefined) updates.notes       = notes;
        if (isActive  !== undefined) updates.is_active   = isActive;

        const { data, error } = await supabase
            .from('wards').update(updates)
            .eq('id', wardId).eq('hospital_id', hospitalId)
            .select().single();
        if (error) throw new AppError('Failed to update ward', 500);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
}

// DELETE /api/hospital-admin/wards/:wardId
export async function deleteWard(req, res, next) {
    const { wardId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        await supabase.from('wards').update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', wardId).eq('hospital_id', hospitalId);
        res.status(200).json({ success: true, message: 'Ward deactivated' });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — BED MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/hospital-admin/wards/:wardId/beds
export async function getWardBeds(req, res, next) {
    const { wardId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        const { data, error } = await supabase
            .from('beds')
            .select('*')
            .eq('ward_id', wardId)
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('bed_number');
        if (error) throw new AppError('Failed to fetch beds', 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// PATCH /api/hospital-admin/beds/:bedId/status
export async function updateBedStatus(req, res, next) {
    const { bedId } = req.params;
    const hospitalId = req.user.hospitalId;
    const { status, notes } = req.body;
    try {
        const valid = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
        if (!valid.includes(status)) throw new AppError('Invalid bed status', 400);
        const { data, error } = await supabase
            .from('beds')
            .update({ status, notes: notes || null, updated_at: new Date().toISOString() })
            .eq('id', bedId).eq('hospital_id', hospitalId)
            .select().single();
        if (error) throw new AppError('Failed to update bed', 500);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — WARD DOCTOR ASSIGNMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/hospital-admin/ward-assignments
export async function getWardAssignments(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data, error } = await supabase
            .from('ward_doctor_assignments')
            .select(`
                id, ward_id, doctor_id, is_active, created_at,
                wards ( ward_name, ward_type ),
                doctor_profiles ( doctor_unique_id, specialization,
                    user_id, users ( full_name, email )
                )
            `)
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            if (isMissingTableError(error)) return res.status(200).json({ success: true, data: [], warning: 'Ward assignment tables not yet created. Run migration 004.' });
            throw new AppError('Failed to fetch assignments: ' + error.message, 500);
        }
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// POST /api/hospital-admin/ward-assignments
export async function assignDoctorToWard(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const { wardId, doctorUserId } = req.body;
    try {
        if (!wardId || !doctorUserId) throw new AppError('wardId and doctorUserId required', 400);

        const { data: dp } = await supabase
            .from('doctor_profiles')
            .select('id')
            .eq('user_id', doctorUserId)
            .eq('hospital_id', hospitalId)
            .single();
        if (!dp) throw new AppError('Doctor not found in this hospital', 404);

        const { data, error } = await supabase
            .from('ward_doctor_assignments')
            .upsert({
                hospital_id: hospitalId, ward_id: wardId,
                doctor_id: dp.id, assigned_by: req.user.id, is_active: true
            }, { onConflict: 'ward_id,doctor_id' })
            .select().single();
        if (error) throw new AppError('Failed to assign doctor: ' + error.message, 500);

        res.status(201).json({ success: true, message: 'Doctor assigned to ward', data });
    } catch (error) { next(error); }
}

// DELETE /api/hospital-admin/ward-assignments/:assignmentId
export async function removeWardAssignment(req, res, next) {
    const { assignmentId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        await supabase.from('ward_doctor_assignments')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', assignmentId).eq('hospital_id', hospitalId);
        res.status(200).json({ success: true });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — HOSPITAL LOCATION
// ══════════════════════════════════════════════════════════════════════════════

// PUT /api/hospital-admin/location
export async function updateHospitalLocation(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const { latitude, longitude, address } = req.body;
    try {
        const { data: existing } = await supabase
            .from('hospital_resources')
            .select('id').eq('hospital_id', hospitalId).maybeSingle();

        let result;
        if (existing) {
            const { data } = await supabase.from('hospital_resources')
                .update({ latitude, longitude, address, updated_at: new Date().toISOString() })
                .eq('hospital_id', hospitalId).select().single();
            result = data;
        } else {
            const { data } = await supabase.from('hospital_resources')
                .insert({ hospital_id: hospitalId, latitude, longitude, address })
                .select().single();
            result = data;
        }
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}

// GET /api/hospital-admin/location
export async function getHospitalLocation(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data } = await supabase.from('hospital_resources')
            .select('latitude, longitude, address').eq('hospital_id', hospitalId).maybeSingle();
        res.status(200).json({ success: true, data: data || null });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCTOR — IP WARD VIEW
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/doctor/ip-wards  — doctor sees their assigned wards + patients
export async function getDoctorIPWards(req, res, next) {
    try {
        const { data: dp } = await supabase
            .from('doctor_profiles')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle();
        if (!dp) return res.status(200).json({ success: true, data: [] });

        // Assigned wards
        const { data: assignments } = await supabase
            .from('ward_doctor_assignments')
            .select('ward_id, wards ( id, ward_name, ward_type, total_beds, floor_number )')
            .eq('doctor_id', dp.id)
            .eq('is_active', true);

        const wards = (assignments || []).map(a => a.wards).filter(Boolean);
        if (wards.length === 0) return res.status(200).json({ success: true, data: [] });

        const wardIds = wards.map(w => w.id);

        // Beds with current admissions
        const { data: beds } = await supabase
            .from('beds')
            .select('*')
            .in('ward_id', wardIds)
            .eq('hospital_id', req.user.hospitalId)
            .eq('is_active', true)
            .order('bed_number');

        // Active admissions
        const { data: admissions } = await supabase
            .from('admissions')
            .select('*')
            .in('ward_id', wardIds)
            .eq('hospital_id', req.user.hospitalId)
            .eq('status', 'ADMITTED')
            .order('admission_date', { ascending: false });

        const admissionMap = {};
        (admissions || []).forEach(a => { admissionMap[a.bed_id] = a; });

        const result = wards.map(ward => ({
            ...ward,
            beds: (beds || [])
                .filter(b => b.ward_id === ward.id)
                .map(bed => ({
                    ...bed,
                    admission: admissionMap[bed.id] || null
                }))
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}

// PATCH /api/doctor/admissions/:admissionId/notes — doctor updates treatment notes
export async function updateAdmissionNotes(req, res, next) {
    const { admissionId } = req.params;
    const { treatmentNotes, diagnosis, labRequested } = req.body;
    const hospitalId = req.user.hospitalId;
    try {
        const updates = { updated_at: new Date().toISOString() };
        if (treatmentNotes !== undefined) updates.treatment_notes = treatmentNotes;
        if (diagnosis !== undefined) updates.diagnosis = diagnosis;
        if (labRequested !== undefined) updates.lab_requested = labRequested;

        const { data, error } = await supabase
            .from('admissions').update(updates)
            .eq('id', admissionId).eq('hospital_id', hospitalId)
            .select().single();
        if (error) throw new AppError('Failed to update notes', 500);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// RECEPTION / NURSE — ADMISSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/nurse/wards — all wards with bed availability
export async function getAllWardsForAdmission(req, res, next) {
    const hospitalId = req.user.hospitalId;
    try {
        const { data: wards, error } = await supabase
            .from('wards')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('ward_name');
        if (error) throw new AppError('Failed to fetch wards', 500);

        const wardIds = (wards || []).map(w => w.id);
        let bedsByWard = {};
        if (wardIds.length > 0) {
            const { data: beds } = await supabase
                .from('beds')
                .select('*')
                .in('ward_id', wardIds)
                .eq('is_active', true)
                .order('bed_number');
            (beds || []).forEach(b => {
                if (!bedsByWard[b.ward_id]) bedsByWard[b.ward_id] = [];
                bedsByWard[b.ward_id].push(b);
            });
        }
        const result = (wards || []).map(w => ({
            ...w,
            beds: bedsByWard[w.id] || [],
            availableBeds: (bedsByWard[w.id] || []).filter(b => b.status === 'AVAILABLE').length
        }));
        res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}

// POST /api/nurse/admissions — admit a patient to a bed
export async function admitPatient(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const {
        wardId, bedId, patientId, patientName, patientPid,
        age, gender, admissionReason, diagnosis, attendingDoctorId
    } = req.body;
    try {
        if (!wardId || !bedId || !patientName) throw new AppError('Ward, bed and patient name required', 400);

        // Verify bed is available
        const { data: bed } = await supabase
            .from('beds').select('status, bed_code').eq('id', bedId).eq('hospital_id', hospitalId).single();
        if (!bed) throw new AppError('Bed not found', 404);
        if (bed.status !== 'AVAILABLE') throw new AppError(`Bed ${bed.bed_code} is not available (${bed.status})`, 400);

        // Create admission
        const { data: admission, error } = await supabase
            .from('admissions')
            .insert({
                hospital_id: hospitalId, ward_id: wardId, bed_id: bedId,
                patient_id: patientId || null, patient_name: patientName,
                patient_pid: patientPid || null, age: age || null, gender: gender || null,
                admission_reason: admissionReason, diagnosis: diagnosis || null,
                attending_doctor_id: attendingDoctorId || null, admitted_by: req.user.id,
                status: 'ADMITTED'
            })
            .select().single();
        if (error) throw new AppError('Failed to admit patient: ' + error.message, 500);

        // Mark bed as OCCUPIED
        await supabase.from('beds').update({
            status: 'OCCUPIED', current_patient_id: patientId || null,
            current_admission_id: admission.id, updated_at: new Date().toISOString()
        }).eq('id', bedId);

        await createActivityLog({
            hospitalId, userId: req.user.id, action: 'PATIENT_ADMITTED',
            entityType: 'admissions', entityId: admission.id, ipAddress: req.ip,
            metadata: { patientName, wardId, bedId }
        });

        res.status(201).json({ success: true, message: 'Patient admitted successfully', data: admission });
    } catch (error) { next(error); }
}

// GET /api/nurse/admissions — all current admissions
export async function getAdmissions(req, res, next) {
    const hospitalId = req.user.hospitalId;
    const { wardId, status = 'ADMITTED' } = req.query;
    try {
        let query = supabase
            .from('admissions')
            .select('*, wards ( ward_name, ward_type ), beds ( bed_code, bed_number )')
            .eq('hospital_id', hospitalId)
            .order('admission_date', { ascending: false });
        if (status !== 'all') query = query.eq('status', status);
        if (wardId) query = query.eq('ward_id', wardId);

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch admissions', 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) { next(error); }
}

// PATCH /api/nurse/admissions/:admissionId/discharge
export async function dischargePatient(req, res, next) {
    const { admissionId } = req.params;
    const hospitalId = req.user.hospitalId;
    try {
        const { data: admission } = await supabase
            .from('admissions').select('bed_id').eq('id', admissionId).eq('hospital_id', hospitalId).single();
        if (!admission) throw new AppError('Admission not found', 404);

        await supabase.from('admissions').update({
            status: 'DISCHARGED', discharge_date: new Date().toISOString(),
            is_active: false, updated_at: new Date().toISOString()
        }).eq('id', admissionId);

        // Free the bed
        await supabase.from('beds').update({
            status: 'CLEANING', current_patient_id: null,
            current_admission_id: null, updated_at: new Date().toISOString()
        }).eq('id', admission.bed_id);

        res.status(200).json({ success: true, message: 'Patient discharged. Bed set to Cleaning.' });
    } catch (error) { next(error); }
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCTOR — ONLINE CONSULT BOOKINGS
// ══════════════════════════════════════════════════════════════════════════════

function normalizeOnlineBookingRow(row) {
    const bookingDate = row?.appointment_date || row?.booking_date || null;
    const bookingTime = row?.appointment_time || row?.booking_time || null;
    return {
        ...row,
        appointment_date: bookingDate,
        appointment_time: bookingTime,
        booking_date: bookingDate,
        booking_time: bookingTime
    };
}

async function resolveDoctorOnlineContext(userId, fallbackHospitalId = null) {
    let doctorProfile = null;
    const { data, error } = await supabase
        .from('doctor_profiles')
        .select('id, user_id, hospital_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (!error && data) doctorProfile = data;

    const profileId = doctorProfile?.id || null;
    const doctorIds = [profileId, userId].filter(Boolean);
    return {
        profileId,
        userId,
        doctorIds,
        hospitalId: doctorProfile?.hospital_id || fallbackHospitalId || null
    };
}

// GET /api/doctor/online-consult/bookings
export async function getOnlineConsultBookings(req, res, next) {
    const { date, status } = req.query;
    try {
        const ctx = await resolveDoctorOnlineContext(req.user.id, req.user.hospitalId);
        if (!ctx.doctorIds.length) return res.status(200).json({ success: true, data: [] });

        const { data, error } = await supabase
            .from('online_consult_bookings')
            .select('*')
            .in('doctor_id', ctx.doctorIds)
            .limit(200);
        if (error) throw new AppError('Failed to fetch bookings', 500);

        let rows = (data || []).map(normalizeOnlineBookingRow);
        if (date) rows = rows.filter(r => String(r.appointment_date || '').slice(0, 10) === date);
        if (status && status !== 'all') {
            const wanted = String(status).toUpperCase();
            rows = rows.filter(r => String(r.status || '').toUpperCase() === wanted);
        }

        rows.sort((a, b) => {
            const aKey = `${a.appointment_date || ''} ${a.appointment_time || ''}`;
            const bKey = `${b.appointment_date || ''} ${b.appointment_time || ''}`;
            return aKey.localeCompare(bKey);
        });

        res.status(200).json({ success: true, data: rows });
    } catch (error) { next(error); }
}

// POST /api/doctor/online-consult/bookings — create booking
export async function createOnlineConsultBooking(req, res, next) {
    const { patientName, patientPhone, patientId, appointmentDate, appointmentTime, reason, department } = req.body;
    try {
        if (!patientName || !appointmentDate || !appointmentTime) {
            throw new AppError('patientName, appointmentDate and appointmentTime are required', 400);
        }

        const ctx = await resolveDoctorOnlineContext(req.user.id, req.user.hospitalId);
        if (!ctx.profileId && !ctx.userId) throw new AppError('Doctor profile not found', 404);

        const seed = String(ctx.profileId || ctx.userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'doctor';
        const meetingLink = `https://meet.jit.si/medtrack-${seed}-${Date.now()}`;

        let { data, error } = await supabase
            .from('online_consult_bookings')
            .insert({
                hospital_id: ctx.hospitalId,
                doctor_id: ctx.profileId || ctx.userId,
                patient_id: patientId || null,
                patient_name: patientName,
                patient_phone: patientPhone || null,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                reason: reason || null,
                status: 'SCHEDULED',
                meeting_link: meetingLink
            })
            .select().single();

        if (error) {
            const legacy = await supabase
                .from('online_consult_bookings')
                .insert({
                    hospital_id: ctx.hospitalId,
                    doctor_id: ctx.userId || ctx.profileId,
                    patient_id: patientId || null,
                    patient_pid: null,
                    patient_name: patientName,
                    department: department || 'General Medicine',
                    booking_date: appointmentDate,
                    booking_time: appointmentTime,
                    status: 'PENDING',
                    notes: reason || null
                })
                .select().single();
            data = legacy.data;
            error = legacy.error;
        }

        if (error) throw new AppError('Failed to create booking: ' + error.message, 500);
        res.status(201).json({ success: true, data: normalizeOnlineBookingRow(data) });
    } catch (error) { next(error); }
}

// PATCH /api/doctor/online-consult/bookings/:bookingId/status
export async function updateBookingStatus(req, res, next) {
    const { bookingId } = req.params;
    const { status, notes, prescriptionId } = req.body;
    try {
        const ctx = await resolveDoctorOnlineContext(req.user.id, req.user.hospitalId);
        if (!ctx.doctorIds.length) throw new AppError('Doctor profile not found', 404);

        const updates = { status: String(status || '').toUpperCase(), updated_at: new Date().toISOString() };
        if (notes !== undefined) updates.notes = notes;
        if (prescriptionId !== undefined) updates.prescription_id = prescriptionId;

        const { data, error } = await supabase
            .from('online_consult_bookings').update(updates)
            .eq('id', bookingId).in('doctor_id', ctx.doctorIds)
            .select().single();
        if (error) throw new AppError('Failed to update booking', 500);
        res.status(200).json({ success: true, data: normalizeOnlineBookingRow(data) });
    } catch (error) { next(error); }
}
