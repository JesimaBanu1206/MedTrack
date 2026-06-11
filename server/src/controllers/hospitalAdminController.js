/**
 * hospitalAdminController.js
 * Hospital Admin panel — staff management + dashboard
 * Strict hospital_id isolation: every query is scoped to req.user.hospitalId
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { sendStaffCredentials } from '../config/mailer.js';
import { createActivityLog } from '../utils/activityLogger.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: resolve hospital_id from the logged-in hospital admin
// ─────────────────────────────────────────────────────────────────────────────
async function resolveHospitalId(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('hospital_id')
        .eq('id', userId)
        .single();
    if (error || !data?.hospital_id) {
        throw new AppError('Hospital admin is not linked to any hospital', 403);
    }
    return data.hospital_id;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: get role id by name
// ─────────────────────────────────────────────────────────────────────────────
async function getRoleId(roleName) {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();
    if (error || !data) throw new AppError(`Role "${roleName}" not found`, 500);
    return data.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generate temp password
// ─────────────────────────────────────────────────────────────────────────────
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN DASHBOARD
// GET /api/hospital-admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalAdminDashboard(req, res, next) {
    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        // Fetch hospital info
        const { data: hospital, error: hospErr } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', hospitalId)
            .single();
        if (hospErr) throw new AppError('Hospital not found', 404);

        // Staff counts by role
        const { data: staffData } = await supabase
            .from('staff_profiles')
            .select('staff_role, is_active')
            .eq('hospital_id', hospitalId)
            .eq('is_deleted', false);

        const allStaff   = staffData || [];
        const totalStaff = allStaff.length;
        const activeStaff = allStaff.filter(s => s.is_active).length;
        const doctorCount = allStaff.filter(s => s.staff_role === 'DOCTOR').length;

        const byRole = allStaff.reduce((acc, s) => {
            acc[s.staff_role] = (acc[s.staff_role] || 0) + 1;
            return acc;
        }, {});

        // Recent activity (last 10)
        const { data: recentActivity } = await supabase
            .from('activity_logs')
            .select('action, entity_type, created_at, metadata')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                hospital,
                stats: {
                    totalDoctors: doctorCount,
                    totalStaff,
                    activeUsers: activeStaff,
                    byRole
                },
                recentActivity: recentActivity || []
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE STAFF MEMBER
// POST /api/hospital-admin/staff
// ─────────────────────────────────────────────────────────────────────────────
export async function createStaff(req, res, next) {
    const { fullName, email, phone, staffRole, department } = req.body;

    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        // Verify hospital is still active
        const { data: hospital } = await supabase
            .from('hospitals')
            .select('id, hospital_name, is_active')
            .eq('id', hospitalId)
            .single();
        if (!hospital?.is_active) throw new AppError('Hospital is inactive. Cannot create staff.', 403);

        // Check email uniqueness
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
        if (existingUser) throw new AppError('Email already in use', 409);

        // Generate credentials
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        // Map staff role to system role
        const roleMap = {
            DOCTOR:         'DOCTOR',
            NURSE:          'NURSE',
            PHARMACIST:     'PHARMACIST',
            LAB_TECHNICIAN: 'LAB_TECHNICIAN',
            RECEPTIONIST:   'RECEPTIONIST',
            OTHER_STAFF:    'OTHER_STAFF'
        };
        const systemRole = roleMap[staffRole.toUpperCase()] || 'OTHER_STAFF';
        const roleId = await getRoleId(systemRole);

        // Create user account
        const { data: newUser, error: userErr } = await supabase
            .from('users')
            .insert({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                phone,
                full_name: fullName,
                role_id: roleId,
                hospital_id: hospitalId,
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id, email')
            .single();

        if (userErr) throw new AppError('Failed to create user: ' + userErr.message, 500);

        // Create staff profile
        const { data: staffProfile, error: staffErr } = await supabase
            .from('staff_profiles')
            .insert({
                user_id: newUser.id,
                hospital_id: hospitalId,
                full_name: fullName,
                phone,
                department,
                staff_role: staffRole.toUpperCase(),
                is_active: true,
                created_by: req.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (staffErr) {
            // Rollback user
            await supabase.from('users').delete().eq('id', newUser.id);
            throw new AppError('Failed to create staff profile: ' + staffErr.message, 500);
        }

        // Send credentials
        const emailSent = await sendStaffCredentials({
            to: email,
            staffName: fullName,
            hospitalName: hospital.hospital_name,
            loginEmail: email,
            tempPassword,
            staffRole: systemRole
        });

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'STAFF_CREATED',
            entityType: 'staff_profile',
            entityId: staffProfile.id,
            ipAddress: req.ip,
            metadata: { staffName: fullName, staffRole, department, emailSent }
        });

        res.status(201).json({
            success: true,
            message: 'Staff member created. Login credentials sent via email.',
            data: { user: { id: newUser.id, email: newUser.email }, staffProfile, emailSent }
        });

    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL STAFF  (only within own hospital)
// GET /api/hospital-admin/staff?role=&search=&page=
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllStaff(req, res, next) {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        let query = supabase
            .from('staff_profiles')
            .select('*', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (role && role !== 'all') query = query.eq('staff_role', role.toUpperCase());
        if (search) query = query.or(`full_name.ilike.%${search}%,department.ilike.%${search}%`);

        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to fetch staff: ' + error.message, 500);

        // Fetch user emails separately (avoids FK name mismatch issues)
        const userIds = (data || []).map(s => s.user_id).filter(Boolean);
        let userMap = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, email, is_active')
                .in('id', userIds);
            (users || []).forEach(u => { userMap[u.id] = u; });
        }
        const enriched = (data || []).map(s => ({ ...s, users: userMap[s.user_id] || null }));

        res.status(200).json({
            success: true,
            data: enriched,
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil((count || 0) / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STAFF MEMBER
// PUT /api/hospital-admin/staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────
export async function updateStaff(req, res, next) {
    const { staffId } = req.params;
    const { fullName, phone, department, staffRole, isActive } = req.body;

    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        // Verify staff belongs to this hospital
        const { data: staff, error: fetchErr } = await supabase
            .from('staff_profiles')
            .select('id, user_id, hospital_id')
            .eq('id', staffId)
            .eq('hospital_id', hospitalId)   // strict isolation
            .eq('is_deleted', false)
            .single();

        if (fetchErr || !staff) throw new AppError('Staff member not found', 404);

        const updatePayload = { updated_at: new Date().toISOString() };
        if (fullName !== undefined)  updatePayload.full_name   = fullName;
        if (phone !== undefined)     updatePayload.phone       = phone;
        if (department !== undefined)updatePayload.department  = department;
        if (staffRole !== undefined) updatePayload.staff_role  = staffRole.toUpperCase();
        if (isActive !== undefined)  updatePayload.is_active   = isActive;

        const { data, error } = await supabase
            .from('staff_profiles')
            .update(updatePayload)
            .eq('id', staffId)
            .select()
            .single();

        if (error) throw new AppError('Failed to update staff: ' + error.message, 500);

        // Sync is_active with user account
        if (isActive !== undefined) {
            await supabase
                .from('users')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', staff.user_id);
        }

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'STAFF_UPDATED',
            entityType: 'staff_profile',
            entityId: staffId,
            ipAddress: req.ip,
            metadata: updatePayload
        });

        res.status(200).json({ success: true, message: 'Staff updated', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE STAFF
// DELETE /api/hospital-admin/staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────
export async function softDeleteStaff(req, res, next) {
    const { staffId } = req.params;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        const { data: staff } = await supabase
            .from('staff_profiles')
            .select('id, user_id')
            .eq('id', staffId)
            .eq('hospital_id', hospitalId)
            .single();

        if (!staff) throw new AppError('Staff member not found', 404);

        await supabase
            .from('staff_profiles')
            .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
            .eq('id', staffId);

        await supabase
            .from('users')
            .update({ is_active: false, is_deleted: true, updated_at: new Date().toISOString() })
            .eq('id', staff.user_id);

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'STAFF_SOFT_DELETED',
            entityType: 'staff_profile',
            entityId: staffId,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Staff member removed' });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL ADMIN LOGIN
// POST /api/hospital-admin/login
// ─────────────────────────────────────────────────────────────────────────────
export async function hospitalAdminLogin(req, res, next) {
    const { email, password } = req.body;
    try {
        // 1. Find user by email
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, email, password_hash, is_active, is_deleted, hospital_id, roles(name)')
            .eq('email', email.toLowerCase())
            .single();

        if (userErr || !user) throw new AppError('Invalid credentials', 401);
        if (user.is_deleted)  throw new AppError('Account has been removed', 403);
        if (!user.is_active)  throw new AppError('Account is inactive. Contact Super Admin.', 403);
        if (user.roles?.name !== 'HOSPITAL_ADMIN') throw new AppError('Not a Hospital Admin account', 403);
        if (!user.hospital_id) throw new AppError('Account not linked to a hospital', 403);

        // 2. Verify password
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new AppError('Invalid credentials', 401);

        // 3. Fetch hospital info
        const { data: hospital } = await supabase
            .from('hospitals')
            .select('id, hospital_name, hospital_code, type, district, is_active')
            .eq('id', user.hospital_id)
            .single();

        if (!hospital?.is_active) throw new AppError('Hospital is deactivated. Contact Super Admin.', 403);

        // 4. Generate tokens
        const accessToken  = generateAccessToken({ userId: user.id, role: 'HOSPITAL_ADMIN' });
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

        if (tokenError) throw new AppError('Failed to start session. Please try again.', 500);

        // 5. Set refresh cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
        });

        await createActivityLog({
            hospitalId: user.hospital_id,
            userId: user.id,
            action: 'HOSPITAL_ADMIN_LOGIN',
            entityType: 'user',
            entityId: user.id,
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: 'HOSPITAL_ADMIN',
                    hospitalId: user.hospital_id,
                    hospital
                }
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT STAFF CSV
// GET /api/hospital-admin/staff/export
// ─────────────────────────────────────────────────────────────────────────────
export async function exportStaffCSV(req, res, next) {
    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        const { data: staff, error } = await supabase
            .from('staff_profiles')
            .select(`
                full_name, phone, staff_role, department, is_active, created_at,
                users!staff_profiles_user_id_fkey ( email )
            `)
            .eq('hospital_id', hospitalId)
            .eq('is_deleted', false)
            .order('staff_role');

        if (error) throw new AppError('Failed to export staff', 500);

        // Build CSV in-memory
        const header = 'Name,Email,Phone,Role,Department,Active,Joined';
        const rows = (staff || []).map(s =>
            [
                `"${s.full_name || ''}"`  ,
                `"${s.users?.email || ''}"`,
                `"${s.phone || ''}"`       ,
                s.staff_role               ,
                `"${s.department || ''}"`  ,
                s.is_active ? 'Yes' : 'No' ,
                s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : ''
            ].join(',')
        );

        const csv = [header, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="staff-${hospitalId}.csv"`);
        res.status(200).send(csv);
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIVITY LOG FOR THIS HOSPITAL
// GET /api/hospital-admin/activity-log
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalActivityLog(req, res, next) {
    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        const { data, error, count } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw new AppError('Failed to fetch activity log: ' + error.message, 500);

        res.status(200).json({
            success: true,
            data: data || [],
            pagination: { total: count || 0, page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/hospital-admin/staff-schedules
export async function getStaffSchedules(req, res, next) {
    const { date } = req.query;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const queryDate = date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('staff_schedules')
            .select('id, hospital_id, staff_user_id, shift_date, shift_type, shift_start, shift_end, location, notes, is_active, created_at')
            .eq('hospital_id', hospitalId)
            .eq('shift_date', queryDate)
            .eq('is_active', true)
            .order('shift_start', { ascending: true });

        if (error) throw new AppError('Failed to fetch schedules: ' + error.message, 500);
        const userIds = [...new Set((data || []).map(s => s.staff_user_id).filter(Boolean))];

        let staffMap = {};
        if (userIds.length > 0) {
            const { data: staffRows } = await supabase
                .from('staff_profiles')
                .select('user_id, full_name, staff_role, department')
                .in('user_id', userIds)
                .eq('hospital_id', hospitalId)
                .eq('is_deleted', false);
            staffMap = (staffRows || []).reduce((acc, row) => {
                acc[row.user_id] = row;
                return acc;
            }, {});
        }

        const enriched = (data || []).map(s => ({ ...s, staff: staffMap[s.staff_user_id] || null }));
        res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        next(error);
    }
}

// POST /api/hospital-admin/staff-schedules
export async function createStaffSchedule(req, res, next) {
    const { staffUserId, shiftDate, shiftType, shiftStart, shiftEnd, location, notes } = req.body;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);

        const { data: staff, error: staffErr } = await supabase
            .from('staff_profiles')
            .select('user_id')
            .eq('hospital_id', hospitalId)
            .eq('user_id', staffUserId)
            .eq('is_deleted', false)
            .single();

        if (staffErr || !staff) throw new AppError('Staff member not found in this hospital', 404);

        const { data, error } = await supabase
            .from('staff_schedules')
            .insert({
                hospital_id: hospitalId,
                staff_user_id: staffUserId,
                shift_date: shiftDate,
                shift_type: shiftType || 'GENERAL',
                shift_start: shiftStart,
                shift_end: shiftEnd,
                location: location || null,
                notes: notes || null,
                assigned_by: req.user.id
            })
            .select()
            .single();

        if (error) throw new AppError('Failed to create schedule: ' + error.message, 500);
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// DELETE /api/hospital-admin/staff-schedules/:scheduleId
export async function deleteStaffSchedule(req, res, next) {
    const { scheduleId } = req.params;
    try {
        const hospitalId = await resolveHospitalId(req.user.id);
        const { error } = await supabase
            .from('staff_schedules')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', scheduleId)
            .eq('hospital_id', hospitalId);

        if (error) throw new AppError('Failed to remove schedule: ' + error.message, 500);
        res.status(200).json({ success: true, message: 'Schedule removed' });
    } catch (error) {
        next(error);
    }
}
