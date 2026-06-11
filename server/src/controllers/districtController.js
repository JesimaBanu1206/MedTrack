/**
 * districtController.js
 * District Health Officer dashboard — district-level monitoring
 * Officers can ONLY see data for their assigned district
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { config } from '../config/env.js';

// ─── Resolve officer's assigned district ─────────────────────────────────────
async function resolveDistrict(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('district, full_name, designation')
        .eq('id', userId)
        .single();
    if (error || !data?.district) throw new AppError('Not linked to a district', 403);
    return data;
}

const normalizeHospitalType = (type) => String(type || '').trim().toUpperCase();
const normalizeAmbulanceStatus = (status) => String(status || '').trim().toUpperCase();
const normalizeBedStatus = (status) => String(status || '').trim().toUpperCase();

function mapDriverDutyToAmbulanceStatus(dutyStatus) {
    const status = normalizeAmbulanceStatus(dutyStatus);
    if (['AVAILABLE', 'ON_DUTY', 'READY'].includes(status)) return 'AVAILABLE';
    if (['ON_MISSION', 'DISPATCHED', 'REACHED_SPOT', 'LEFT_SPOT', 'REACHED_HOSPITAL'].includes(status)) return 'DISPATCHED';
    if (status === 'MAINTENANCE') return 'MAINTENANCE';
    return 'OFFLINE';
}

async function getDistrictAmbulanceRows(district, hospitals = []) {
    const hospitalMap = (hospitals || []).reduce((acc, h) => {
        acc[h.id] = h.hospital_name;
        return acc;
    }, {});
    const hospIds = (hospitals || []).map(h => h.id).filter(Boolean);

    let fleetRows = [];
    if (hospIds.length > 0) {
        const { data: ambulances } = await supabase
            .from('ambulances')
            .select('id, vehicle_number, status, driver_name, driver_phone, latitude, longitude, hospital_id, last_updated')
            .in('hospital_id', hospIds);

        fleetRows = (ambulances || []).map(a => ({
            ...a,
            status: normalizeAmbulanceStatus(a.status),
            duty_status: null,
            hospital_name: hospitalMap[a.hospital_id] || 'Unknown',
            source: 'HOSPITAL_AMBULANCE'
        }));
    }

    let emergencyRows = [];
    try {
        const { data: emergencyDrivers, error } = await supabase
            .from('emergency_drivers')
            .select(`
                id, driver_name, district, unit_number, duty_status, last_location_at, updated_at,
                users!emergency_drivers_user_id_fkey ( phone )
            `)
            .eq('district', district)
            .eq('approval_status', 'APPROVED');

        if (!error) {
            emergencyRows = (emergencyDrivers || []).map(d => ({
                id: `driver-${d.id}`,
                vehicle_number: d.unit_number || `UNIT-${String(d.id).slice(0, 6).toUpperCase()}`,
                status: mapDriverDutyToAmbulanceStatus(d.duty_status),
                duty_status: d.duty_status || null,
                driver_name: d.driver_name,
                driver_phone: d.users?.phone || null,
                latitude: null,
                longitude: null,
                hospital_id: null,
                hospital_name: 'District 108 Emergency',
                last_updated: d.last_location_at || d.updated_at || null,
                source: 'EMERGENCY_DRIVER'
            }));
        }
    } catch {
        emergencyRows = [];
    }

    return [...fleetRows, ...emergencyRows];
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// POST /api/district/login
// ─────────────────────────────────────────────────────────────────────────────
export async function districtOfficerLogin(req, res, next) {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, password_hash, is_active, is_deleted, district, designation, full_name, roles(name)')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !user) throw new AppError('Invalid credentials', 401);
        if (user.is_deleted) throw new AppError('Account removed', 403);
        if (!user.is_active) throw new AppError('Account inactive', 403);
        if (user.roles?.name !== 'DISTRICT_OFFICER')
            throw new AppError('Not a district officer account', 403);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new AppError('Invalid credentials', 401);

        const accessToken = generateAccessToken({ userId: user.id, role: 'DISTRICT_OFFICER' });
        const refreshToken = generateRefreshToken({ userId: user.id });
        const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const { error: tokenError } = await supabase
            .from('refresh_tokens')
            .insert({
                user_id: user.id,
                token: refreshToken,
                device_info: req.headers['user-agent'],
                ip_address: req.ip,
                expires_at: refreshExpiresAt.toISOString()
            });

        if (tokenError) throw new AppError('Failed to start session. Please try again.', 500);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, secure: config.nodeEnv === 'production',
            sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            data: {
                accessToken,
                user: {
                    id: user.id, email: user.email, role: 'DISTRICT_OFFICER',
                    district: user.district, designation: user.designation,
                    fullName: user.full_name
                }
            }
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRICT OVERVIEW DASHBOARD
// GET /api/district/overview
// ─────────────────────────────────────────────────────────────────────────────
export async function getDistrictOverview(req, res, next) {
    try {
        const { district } = await resolveDistrict(req.user.id);

        // All hospitals in district
        const { data: hospitals, error: hErr } = await supabase
            .from('hospitals')
            .select('id, hospital_name, type, address, is_active, total_beds, available_beds, op_today, ip_today, revenue_today')
            .eq('district', district)
            .eq('is_active', true);

        if (hErr) throw new AppError('Failed to fetch hospitals', 500);
        const hosp = hospitals || [];

        const hospIds = hosp.map(h => h.id);
        const ambulances = await getDistrictAmbulanceRows(district, hosp);

        // Beds summary
        const { data: beds } = hospIds.length > 0 ? await supabase
            .from('beds')
            .select('status, hospital_id')
            .in('hospital_id', hospIds) : { data: [] };
        const bedData = beds || [];

        // AI Alerts for district
        const { data: alerts } = await supabase
            .from('disease_alerts')
            .select('*')
            .eq('district', district)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10);

        // Wards summary
        const { data: wards } = hospIds.length > 0 ? await supabase
            .from('wards')
            .select('id, ward_name, ward_type, total_beds, available_beds, hospital_id')
            .in('hospital_id', hospIds) : { data: [] };

        // Stats
        const stats = {
            hospitals: {
                total: hosp.length,
                gh: hosp.filter(h => {
                    const type = normalizeHospitalType(h.type);
                    return type === 'GH' || type === 'GOVERNMENT';
                }).length,
                government: hosp.filter(h => {
                    const type = normalizeHospitalType(h.type);
                    return type === 'GH' || type === 'GOVERNMENT';
                }).length,
                phc: hosp.filter(h => normalizeHospitalType(h.type) === 'PHC').length,
                private: hosp.filter(h => normalizeHospitalType(h.type) === 'PRIVATE').length,
                clinic: hosp.filter(h => normalizeHospitalType(h.type) === 'CLINIC').length
            },
            beds: {
                total: bedData.length,
                available: bedData.filter(b => normalizeBedStatus(b.status) === 'AVAILABLE').length,
                occupied: bedData.filter(b => normalizeBedStatus(b.status) === 'OCCUPIED').length,
                maintenance: bedData.filter(b => normalizeBedStatus(b.status) === 'MAINTENANCE').length
            },
            patients: {
                op_today: hosp.reduce((s, h) => s + (h.op_today || 0), 0),
                ip_today: hosp.reduce((s, h) => s + (h.ip_today || 0), 0)
            },
            ambulances: {
                total: ambulances.length,
                available: ambulances.filter(a => normalizeAmbulanceStatus(a.status) === 'AVAILABLE').length,
                dispatched: ambulances.filter(a => normalizeAmbulanceStatus(a.status) === 'DISPATCHED').length,
                maintenance: ambulances.filter(a => normalizeAmbulanceStatus(a.status) === 'MAINTENANCE').length,
                offline: ambulances.filter(a => normalizeAmbulanceStatus(a.status) === 'OFFLINE').length
            },
            revenue: hosp.reduce((s, h) => s + (h.revenue_today || 0), 0),
            todayRevenue: hosp.reduce((s, h) => s + (h.revenue_today || 0), 0),
            activeAlerts: (alerts || []).filter(a => a.severity === 'CRITICAL').length
        };

        res.status(200).json({
            success: true,
            data: {
                district,
                stats,
                hospitals: hosp,
                ambulances,
                alerts: alerts || [],
                wards: wards || [],
                wardBeds: bedData
            }
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET HOSPITAL DETAILS (within district only)
// GET /api/district/hospitals/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalDetail(req, res, next) {
    const { id } = req.params;
    try {
        const { district } = await resolveDistrict(req.user.id);

        const { data: hospital, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', id)
            .eq('district', district)
            .single();

        if (error || !hospital) throw new AppError('Hospital not found in your district', 404);

        // Ward beds
        const { data: wards } = await supabase
            .from('wards')
            .select('id, ward_name, ward_type, total_beds, available_beds')
            .eq('hospital_id', id);

        // Today's queue count
        const today = new Date().toISOString().split('T')[0];
        const { count: opCount } = await supabase
            .from('op_queue')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', id)
            .eq('visit_date', today);

        res.status(200).json({
            success: true,
            data: { ...hospital, wards: wards || [], op_today_live: opCount || 0 }
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DISEASE TRENDS FOR DISTRICT
// GET /api/district/disease-trends
// ─────────────────────────────────────────────────────────────────────────────
export async function getDiseaseTrends(req, res, next) {
    const { days = 7 } = req.query;
    try {
        const { district } = await resolveDistrict(req.user.id);

        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const { data, error } = await supabase
            .from('disease_alerts')
            .select('disease_name, severity, case_count, report_date, hospital_id')
            .eq('district', district)
            .gte('report_date', since.toISOString().split('T')[0])
            .order('report_date', { ascending: true });

        if (error) throw new AppError('Failed to fetch trends', 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET AMBULANCES IN DISTRICT
// GET /api/district/ambulances
// ─────────────────────────────────────────────────────────────────────────────
export async function getDistrictAmbulances(req, res, next) {
    try {
        const { district } = await resolveDistrict(req.user.id);

        const { data: hospitals } = await supabase
            .from('hospitals')
            .select('id, hospital_name')
            .eq('district', district);

        const enriched = await getDistrictAmbulanceRows(district, hospitals || []);

        res.status(200).json({ success: true, data: enriched });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACKNOWLEDGE / DISMISS ALERT
// PATCH /api/district/alerts/:id/acknowledge
// ─────────────────────────────────────────────────────────────────────────────
export async function acknowledgeAlert(req, res, next) {
    const { id } = req.params;
    try {
        const { district } = await resolveDistrict(req.user.id);

        const { data, error } = await supabase
            .from('disease_alerts')
            .update({ is_active: false, acknowledged_by: req.user.id, acknowledged_at: new Date().toISOString() })
            .eq('id', id)
            .eq('district', district)
            .select()
            .single();

        if (error) throw new AppError('Failed to acknowledge alert', 500);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE DISTRICT REPORT
// GET /api/district/report
// ─────────────────────────────────────────────────────────────────────────────
export async function getDistrictReport(req, res, next) {
    const { from, to } = req.query;
    try {
        const { district } = await resolveDistrict(req.user.id);
        const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const toDate   = to   || new Date().toISOString().split('T')[0];

        const { data: hospitals } = await supabase
            .from('hospitals')
            .select('id, hospital_name, type, total_beds, available_beds')
            .eq('district', district)
            .eq('is_active', true);

        const hospIds = (hospitals || []).map(h => h.id);

        const { data: queueStats } = hospIds.length > 0 ? await supabase
            .from('op_queue')
            .select('visit_date, hospital_id, status')
            .in('hospital_id', hospIds)
            .gte('visit_date', fromDate)
            .lte('visit_date', toDate) : { data: [] };

        const { data: alerts } = await supabase
            .from('disease_alerts')
            .select('disease_name, severity, case_count, report_date')
            .eq('district', district)
            .gte('report_date', fromDate)
            .lte('report_date', toDate);

        res.status(200).json({
            success: true,
            data: {
                district, fromDate, toDate,
                hospitals: hospitals || [],
                queueStats: queueStats || [],
                alerts: alerts || []
            }
        });
    } catch (err) { next(err); }
}
