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
            .select('id, total_beds, available_beds, icu_beds')
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
        const hospitalIds = (hospitals || []).map(h => h.id).filter(Boolean);

        // 2. Patient count
        const { count: totalPatients, error: patErr } = await supabase
            .from('patients')
            .select('id', { count: 'exact', head: true });
        if (patErr) throw new AppError('Failed to fetch patient count: ' + patErr.message, 500);

        // 2b. Staff counts (doctor, nurse, total staff)
        let staffQuery = supabase
            .from('staff_profiles')
            .select('staff_role, hospital_id')
            .eq('is_deleted', false);
        if (filterDistrict) {
            if (hospitalIds.length === 0) {
                staffQuery = staffQuery.in('hospital_id', ['00000000-0000-0000-0000-000000000000']);
            } else {
                staffQuery = staffQuery.in('hospital_id', hospitalIds);
            }
        }
        const { data: staffRows, error: staffErr } = await staffQuery;
        if (staffErr) throw new AppError('Failed to fetch staff stats: ' + staffErr.message, 500);
        const staffList = staffRows || [];
        const totalDoctors = staffList.filter(s => s.staff_role === 'DOCTOR').length;
        const totalNurses = staffList.filter(s => s.staff_role === 'NURSE').length;
        const totalStaff = staffList.length;

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
                staff: { total: totalStaff, doctors: totalDoctors, nurses: totalNurses },
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
            .select('*')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(10);

        if (filterDistrict) query = query.eq('district', filterDistrict);

        const { data, error } = await query;

        // Gracefully return empty list on any DB error (e.g. missing column during migration)
        if (error) {
            console.warn('[getResourceMonitor] DB warning:', error.message);
            return res.status(200).json({ success: true, data: [] });
        }

        // Normalize shape so frontend keeps working regardless of schema version
        const normalized = (data || []).map(h => ({
            name: h.hospital_name || h.name || 'Unknown',
            hospital_name: h.hospital_name || h.name || 'Unknown',
            district: h.district,
            is_active: h.is_active,
            icu_beds: h.icu_beds || 0,
            available_beds: h.available_beds || 0,
            total_beds: h.total_beds || 0,
            updated_at: h.updated_at
        }));

        res.status(200).json({ success: true, data: normalized });
    } catch (error) {
        // Never let this endpoint kill the dashboard
        console.error('[getResourceMonitor] Unexpected error:', error.message);
        res.status(200).json({ success: true, data: [] });
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

// ─────────────────────────────────────────────────────────────────────────────
// GET BED AVAILABILITY ACROSS ALL HOSPITALS
// GET /api/super-admin/bed-availability?search=&district=
// ─────────────────────────────────────────────────────────────────────────────
export async function getSuperAdminBedAvailability(req, res, next) {
    const { search = '', district = 'all' } = req.query;
    try {
        // ── Step 1: Fetch hospitals (multiple fallback strategies) ─────────────
        let hospitals = [];
        const hospitalSelects = [
            'id, name, hospital_name, district, type, hospital_code, is_active',
            'id, name, hospital_name, district, type, is_active',
            'id, hospital_name, district, type, is_active',
            'id, hospital_name, district',
        ];

        for (const sel of hospitalSelects) {
            try {
                let q = supabase.from('hospitals').select(sel);
                if (district !== 'all') q = q.eq('district', district);
                if (search.trim()) {
                    const s = search.trim();
                    q = q.or(`hospital_name.ilike.%${s}%,district.ilike.%${s}%`);
                }
                const { data, error } = await q.order('hospital_name', { ascending: true });
                if (!error && Array.isArray(data)) {
                    hospitals = data;
                    break;
                }
            } catch { /* try next fallback */ }
        }

        // Filter out inactive hospitals in JS (handles case where is_active may not exist)
        hospitals = hospitals.filter(h => h.is_active !== false);

        if (!hospitals.length) {
            return res.status(200).json({ success: true, data: [] });
        }

        const hospitalIds = hospitals.map(h => h.id).filter(Boolean);

        // ── Step 2: Fetch wards (graceful — returns empty array on any error) ──
        let wards = [];
        try {
            // Try with is_active filter first
            const { data: w1, error: e1 } = await supabase
                .from('wards')
                .select('id, hospital_id, ward_name, ward_type, total_beds, floor_number, is_active')
                .in('hospital_id', hospitalIds)
                .order('ward_name');

            if (!e1 && Array.isArray(w1)) {
                // Filter active wards in JS so missing is_active column doesn't break us
                wards = w1.filter(w => w.is_active !== false);
            } else if (e1) {
                // Table might not have is_active column — try without it
                const { data: w2, error: e2 } = await supabase
                    .from('wards')
                    .select('id, hospital_id, ward_name, ward_type, total_beds, floor_number')
                    .in('hospital_id', hospitalIds)
                    .order('ward_name');
                if (!e2 && Array.isArray(w2)) wards = w2;
                // if wards table doesn't exist at all, wards stays []
            }
        } catch (wardFetchErr) {
            console.warn('[getSuperAdminBedAvailability] wards fetch skipped:', wardFetchErr.message);
        }

        // ── Step 3: Fetch beds (graceful — returns empty array on any error) ──
        let beds = [];
        try {
            // Try with is_active filter
            const { data: b1, error: be1 } = await supabase
                .from('beds')
                .select('hospital_id, ward_id, status, is_active')
                .in('hospital_id', hospitalIds);

            if (!be1 && Array.isArray(b1)) {
                beds = b1.filter(b => b.is_active !== false);
            } else if (be1) {
                // Try without is_active column
                const { data: b2, error: be2 } = await supabase
                    .from('beds')
                    .select('hospital_id, ward_id, status')
                    .in('hospital_id', hospitalIds);
                if (!be2 && Array.isArray(b2)) beds = b2;
            }
        } catch (bedFetchErr) {
            console.warn('[getSuperAdminBedAvailability] beds fetch skipped:', bedFetchErr.message);
        }

        // ── Step 4: Build bed stats per ward ──────────────────────────────────
        const bedStatsByWard = {};
        beds.forEach(b => {
            if (!b.ward_id) return;
            if (!bedStatsByWard[b.ward_id]) {
                bedStatsByWard[b.ward_id] = { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
            }
            bedStatsByWard[b.ward_id].total++;
            const s = (b.status || '').toUpperCase();
            if (s === 'AVAILABLE')   bedStatsByWard[b.ward_id].available++;
            if (s === 'OCCUPIED')    bedStatsByWard[b.ward_id].occupied++;
            if (s === 'CLEANING')    bedStatsByWard[b.ward_id].cleaning++;
            if (s === 'MAINTENANCE') bedStatsByWard[b.ward_id].maintenance++;
        });

        // ── Step 5: Build wards per hospital ─────────────────────────────────
        const wardsByHospital = {};
        wards.forEach(w => {
            if (!wardsByHospital[w.hospital_id]) wardsByHospital[w.hospital_id] = [];
            const bs = bedStatsByWard[w.id] || { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
            // If beds table is empty, fall back to ward.total_beds as total
            const effectiveBeds = bs.total > 0 ? bs : {
                total: w.total_beds || 0,
                available: w.total_beds || 0,
                occupied: 0, cleaning: 0, maintenance: 0
            };
            wardsByHospital[w.hospital_id].push({ ...w, bedStats: effectiveBeds });
        });

        // ── Step 6: Compose final result ──────────────────────────────────────
        const result = hospitals.map(h => {
            const hWards = wardsByHospital[h.id] || [];
            const totalBeds     = hWards.reduce((s, w) => s + (w.bedStats.total || 0), 0);
            const availableBeds = hWards.reduce((s, w) => s + (w.bedStats.available || 0), 0);
            const occupancyPct  = totalBeds > 0 ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0;
            return {
                id: h.id,
                hospital_code: h.hospital_code || (h.id ? h.id.slice(0, 8).toUpperCase() : '—'),
                name: h.hospital_name || h.name || 'Unknown',
                district: h.district || '—',
                type: h.type || '—',
                totalWards: hWards.length,
                totalBeds,
                availableBeds,
                occupiedBeds: totalBeds - availableBeds,
                occupancyPct,
                wards: hWards
            };
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[getSuperAdminBedAvailability] Unexpected error:', error.message);
        // Never let this crash — return empty list so the UI keeps working
        res.status(200).json({ success: true, data: [], _warning: 'Bed data temporarily unavailable' });
    }
}
