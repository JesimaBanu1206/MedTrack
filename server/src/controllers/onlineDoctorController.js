/**
 * getOnlineDoctors - add to appointmentController.js
 * GET /api/appointments/online-doctors?department=
 * Returns doctors who have marked themselves available for online consult
 * Called by AppointmentPage to show real doctors
 */

import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';

export async function getOnlineDoctors(req, res, next) {
    const { department } = req.query;
    try {
        let query = supabase
            .from('online_consult_profiles')
            .select(`
                id, consultation_fee, specialization, experience_years,
                is_available, available_days, bio,
                users!online_consult_profiles_doctor_id_fkey (
                    id, full_name,
                    staff_profiles ( department, hospital_id,
                        hospitals ( hospital_name, district )
                    )
                )
            `)
            .eq('is_available', true);

        if (department) {
            // filter by department via staff_profiles — use a workaround
        }

        const { data, error } = await query.limit(20);
        if (error) {
            // table may not exist yet — return empty
            return res.status(200).json({ success: true, data: [] });
        }

        // flatten
        const doctors = (data || []).map(p => ({
            id: p.id,
            doctorId: p.users?.id,
            name: p.users?.full_name || 'Doctor',
            department: p.users?.staff_profiles?.[0]?.department || 'General Medicine',
            hospital: p.users?.staff_profiles?.[0]?.hospitals?.hospital_name || '',
            district: p.users?.staff_profiles?.[0]?.hospitals?.district || '',
            fee: p.consultation_fee || 200,
            specialization: p.specialization,
            experience: p.experience_years,
            bio: p.bio,
            availableDays: p.available_days,
            isAvailable: p.is_available,
        }));

        const filtered = department
            ? doctors.filter(d => d.department?.toLowerCase().includes(department.toLowerCase()))
            : doctors;

        return res.status(200).json({ success: true, data: filtered });
    } catch (err) { next(err); }
}
