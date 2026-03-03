import supabase from '../config/supabase.js';
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER: safe pool query — returns { rows } or throws with a clear message
───────────────────────────────────────────────────────────────────────────── */
async function safeQuery(label, sql, params = []) {
    try {
        return await pool.query(sql, params);
    } catch (err) {
        console.error(`[DB ERROR] ${label}:`, err.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        // Re-throw with the exact SQL label so errorHandler logs it clearly
        const enhanced = new Error(`[DB] ${label} failed: ${err.message}`);
        enhanced.originalError = err;
        enhanced.statusCode = 500;
        throw enhanced;
    }
}

/**
 * @desc    Get dashboard statistics for Super Admin
 * @route   GET /api/super-admin/stats
 */
export async function getDashboardStats(req, res, next) {
    const { district } = req.query;
    const filterDistrict = district && district !== 'all' ? district : null;

    try {
        // 1. Hospital stats via Supabase
        let hospitalQuery = supabase
            .from('hospitals')
            .select('total_beds, available_beds, icu_beds')
            .eq('is_active', true);
        if (filterDistrict) hospitalQuery = hospitalQuery.eq('district', filterDistrict);
        const { data: hospitals, error: hospErr } = await hospitalQuery;
        if (hospErr) throw new AppError('Failed to fetch hospital stats: ' + hospErr.message, 500);

        const hospitalStats = {
            total_hospitals: (hospitals || []).length,
            total_beds: (hospitals || []).reduce((s, h) => s + (h.total_beds || 0), 0),
            available_beds: (hospitals || []).reduce((s, h) => s + (h.available_beds || 0), 0),
            icu_beds: (hospitals || []).reduce((s, h) => s + (h.icu_beds || 0), 0),
        };

        // 2. Patient count
        const { count: totalPatients, error: patErr } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true });
        if (patErr) throw new AppError('Failed to fetch patient count: ' + patErr.message, 500);

        // 3. Appointment trend — last 7 days (group by date in JS)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let apptQuery = supabase
            .from('appointments')
            .select('appointment_date, hospital_id')
            .gte('appointment_date', sevenDaysAgo.toISOString().split('T')[0]);

        // If filtering by district, get hospital IDs in that district first
        if (filterDistrict) {
            const { data: distHospitals } = await supabase
                .from('hospitals')
                .select('id')
                .eq('district', filterDistrict)
                .eq('is_active', true);
            const ids = (distHospitals || []).map(h => h.id);
            if (ids.length > 0) {
                apptQuery = apptQuery.in('hospital_id', ids);
            }
        }

        const { data: appts, error: apptErr } = await apptQuery;
        if (apptErr) throw new AppError('Failed to fetch appointments: ' + apptErr.message, 500);

        // Group by date in JS
        const trendMap = {};
        for (const a of (appts || [])) {
            const d = a.appointment_date?.split('T')[0] || a.appointment_date;
            trendMap[d] = (trendMap[d] || 0) + 1;
        }
        const trends = Object.entries(trendMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));

        // 4. District distribution
        let distQuery = supabase
            .from('hospitals')
            .select('district')
            .eq('is_active', true);
        const { data: allHospitals, error: distErr } = await distQuery;
        if (distErr) throw new AppError('Failed to fetch district data: ' + distErr.message, 500);

        const distMap = {};
        for (const h of (allHospitals || [])) {
            distMap[h.district] = (distMap[h.district] || 0) + 1;
        }
        const districts = Object.entries(distMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([district, count]) => ({ district, count }));

        res.status(200).json({
            success: true,
            data: {
                hospitals: hospitalStats,
                patients: { total: totalPatients || 0 },
                trends,
                districts
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get detailed hospital resource monitor
 * @route   GET /api/super-admin/resources
 */
export async function getResourceMonitor(req, res, next) {
    const { district } = req.query;
    const filterDistrict = district && district !== 'all' ? district : null;

    try {
        let query = supabase
            .from('hospitals')
            .select('name, district, icu_beds, available_beds, total_beds, updated_at')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(10);

        if (filterDistrict) query = query.eq('district', filterDistrict);

        const { data, error } = await query;
        if (error) throw new AppError('Failed to fetch resources: ' + error.message, 500);

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get all emergency driver registrations
 * @route   GET /api/super-admin/emergency/drivers
 */
export async function getEmergencyDriverRequests(req, res, next) {
    try {
        // Use Supabase client (avoids pg pool schema-cache issues with new columns)
        const { data, error } = await supabase
            .from('emergency_drivers')
            .select(`
                id,
                user_id,
                driver_name,
                license_number,
                district,
                approval_status,
                unit_number,
                reject_reason,
                duty_status,
                sos_note,
                last_location_at,
                license_image_url,
                profile_image_url,
                created_at,
                users!emergency_drivers_user_id_fkey (
                    email,
                    phone,
                    is_verified,
                    is_active
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Supabase] getEmergencyDriverRequests error:', error);
            throw new AppError(`Failed to fetch driver registrations: ${error.message}`, 500);
        }

        // Normalise: Supabase returns users as nested object
        const normalized = (data || []).map(row => ({
            ...row,
            users: row.users ?? { email: null, phone: null, is_verified: false, is_active: false }
        }));

        res.status(200).json({
            success: true,
            data: normalized
        });
    } catch (error) {
        console.error('getEmergencyDriverRequests error:', error);
        next(error);
    }
}

/**
 * @desc    Approve or reject an emergency driver
 * @route   PATCH /api/super-admin/emergency/drivers/:driverId/access
 */
export async function updateEmergencyDriverAccess(req, res, next) {
    const { driverId } = req.params;
    const { approvalStatus, unitNumber, rejectReason } = req.body;

    try {
        const { data: existingDriver, error: fetchError } = await supabase
            .from('emergency_drivers')
            .select('id, user_id')
            .eq('id', driverId)
            .single();

        if (fetchError || !existingDriver) {
            return res.status(404).json({ success: false, message: 'Emergency driver not found' });
        }

        const updatePayload = {
            approval_status: approvalStatus,
            unit_number: approvalStatus === 'APPROVED' ? unitNumber : null,
            reject_reason: approvalStatus === 'REJECTED' ? rejectReason : null,
            approved_by: approvalStatus === 'APPROVED' ? req.user.id : null,
            approved_at: approvalStatus === 'APPROVED' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        };

        const { error: updateDriverError } = await supabase
            .from('emergency_drivers')
            .update(updatePayload)
            .eq('id', driverId);

        if (updateDriverError) throw updateDriverError;

        // Activate user account on approval, deactivate on rejection
        const { error: userUpdateError } = await supabase
            .from('users')
            .update({ is_active: approvalStatus === 'APPROVED' })
            .eq('id', existingDriver.user_id);

        if (userUpdateError) throw userUpdateError;

        res.status(200).json({
            success: true,
            message: approvalStatus === 'APPROVED'
                ? 'Emergency driver approved — login access granted'
                : 'Emergency driver rejected'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Update super admin email/password
 * @route   PATCH /api/super-admin/account
 */
export async function updateSuperAdminAccount(req, res, next) {
    const { email, currentPassword, newPassword } = req.body;

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, password_hash')
            .eq('id', req.user.id)
            .single();

        if (userError || !user) throw new AppError('Super admin account not found', 404);

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) throw new AppError('Current password is incorrect', 401);

        if (email !== user.email) {
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .neq('id', req.user.id)
                .maybeSingle();
            if (existing) throw new AppError('Email already in use', 409);
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase
            .from('users')
            .update({ email, password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('id', req.user.id);

        if (updateError) throw new AppError('Failed to update account', 500);

        res.status(200).json({ success: true, message: 'Account updated successfully', data: { email } });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get all emergency alerts (reported accidents) for Super Admin
 * @route   GET /api/super-admin/emergency/alerts
 */
export async function getEmergencyAlerts(req, res, next) {
    try {
        const { data: alerts, error } = await supabase
            .from('emergency_alerts')
            .select(`
                id,
                image_url,
                latitude,
                longitude,
                status,
                assigned_unit_no,
                unit_details,
                metadata,
                created_at,
                updated_at,
                user_id
            `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw new AppError(`Failed to fetch alerts: ${error.message}`, 500);

        // Enrich each alert with driver info if assigned
        const enriched = await Promise.all((alerts || []).map(async (alert) => {
            let driverInfo = null;
            if (alert.assigned_unit_no) {
                const { data: driver } = await supabase
                    .from('emergency_drivers')
                    .select(`
                        id, driver_name, district, duty_status, last_location_at,
                        users!emergency_drivers_user_id_fkey ( phone )
                    `)
                    .eq('unit_number', alert.assigned_unit_no)
                    .maybeSingle();

                if (driver) {
                    // get latest GPS
                    const { data: locRows } = await supabase
                        .from('emergency_driver_locations')
                        .select('latitude, longitude, recorded_at')
                        .eq('driver_id', driver.id)
                        .order('recorded_at', { ascending: false })
                        .limit(1);

                    driverInfo = {
                        driver_name: driver.driver_name,
                        district: driver.district,
                        duty_status: driver.duty_status,
                        phone: driver.users?.phone ?? null,
                        last_location_at: driver.last_location_at,
                        live_lat: locRows?.[0]?.latitude ?? null,
                        live_lng: locRows?.[0]?.longitude ?? null,
                    };
                }
            }
            return { ...alert, driver: driverInfo };
        }));

        res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get ALL registered drivers (any approval status) with live status
 * @route   GET /api/super-admin/emergency/drivers/fleet
 */
export async function getAllDriversFleet(req, res, next) {
    try {
        const { data: drivers, error } = await supabase
            .from('emergency_drivers')
            .select(`
                id, driver_name, license_number, district,
                approval_status, unit_number, duty_status,
                last_location_at, profile_image_url,
                users!emergency_drivers_user_id_fkey ( phone, email, is_active )
            `)
            .order('driver_name', { ascending: true });

        if (error) throw new AppError(`Failed to fetch fleet: ${error.message}`, 500);

        const now = Date.now();
        const data = await Promise.all((drivers || []).map(async (d) => {
            const { data: locRows } = await supabase
                .from('emergency_driver_locations')
                .select('latitude, longitude, recorded_at')
                .eq('driver_id', d.id)
                .order('recorded_at', { ascending: false })
                .limit(1);

            const loc = locRows?.[0] ?? null;
            const lastAt = d.last_location_at ? new Date(d.last_location_at).getTime() : null;
            const isOnline = !!lastAt && (now - lastAt) <= 3 * 60 * 1000;

            const { count: missionsDone } = await supabase
                .from('emergency_driver_response_logs')
                .select('id', { count: 'exact', head: true })
                .eq('driver_id', d.id)
                .eq('status', 'COMPLETED');

            return {
                id: d.id,
                driver_name: d.driver_name,
                license_number: d.license_number,
                district: d.district,
                approval_status: d.approval_status,
                unit_number: d.unit_number,
                duty_status: d.duty_status,
                last_location_at: d.last_location_at,
                profile_image_url: d.profile_image_url,
                phone: d.users?.phone ?? null,
                email: d.users?.email ?? null,
                is_active: d.users?.is_active ?? false,
                latitude: loc?.latitude ?? null,
                longitude: loc?.longitude ?? null,
                is_online: isOnline,
                total_missions_done: missionsDone ?? 0,
            };
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    108 Ambulance live fleet overview (approved drivers only)
 * @route   GET /api/super-admin/ambulance/use
 */
export async function getAmbulanceUsageOverview(req, res, next) {
    try {
        // Use Supabase client — avoids LATERAL join issues if table schema is inconsistent
        const { data: drivers, error: driverError } = await supabase
            .from('emergency_drivers')
            .select(`
                id,
                driver_name,
                license_number,
                district,
                unit_number,
                duty_status,
                last_location_at,
                users!emergency_drivers_user_id_fkey ( phone, email )
            `)
            .eq('approval_status', 'APPROVED')
            .order('driver_name', { ascending: true });

        if (driverError) {
            console.error('[Supabase] getAmbulanceUsageOverview drivers error:', driverError);
            throw new AppError(`Failed to fetch fleet data: ${driverError.message}`, 500);
        }

        const now = Date.now();

        // For each driver, get latest location + today's response count
        const data = await Promise.all((drivers || []).map(async (driver) => {
            // Latest location
            const { data: locRows } = await supabase
                .from('emergency_driver_locations')
                .select('latitude, longitude, recorded_at')
                .eq('driver_id', driver.id)
                .order('recorded_at', { ascending: false })
                .limit(1);

            const loc = locRows?.[0] ?? null;

            // Today's response count
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const { count: responseCount } = await supabase
                .from('emergency_driver_response_logs')
                .select('id', { count: 'exact', head: true })
                .eq('driver_id', driver.id)
                .gte('responded_at', todayStart.toISOString());

            const lastLocationAt = driver.last_location_at
                ? new Date(driver.last_location_at).getTime()
                : null;
            const isOnline = !!lastLocationAt && (now - lastLocationAt) <= 3 * 60 * 1000;

            return {
                id: driver.id,
                driver_name: driver.driver_name,
                license_number: driver.license_number,
                district: driver.district,
                unit_number: driver.unit_number,
                duty_status: driver.duty_status,
                last_location_at: driver.last_location_at,
                phone: driver.users?.phone ?? null,
                email: driver.users?.email ?? null,
                latitude: loc?.latitude ?? null,
                longitude: loc?.longitude ?? null,
                today_total_responses: responseCount ?? 0,
                is_online: isOnline,
                is_ready_for_response: driver.duty_status === 'AVAILABLE'
            };
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('getAmbulanceUsageOverview error:', error);
        next(error);
    }
}
