/**
 * hospitalController.js
 * Super Admin → GH & PHC Centres management
 * All operations are hospital-aware and use soft-delete.
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { sendHospitalAdminCredentials } from '../config/mailer.js';
import { createActivityLog } from '../utils/activityLogger.js';

function isMissingColumnError(err) {
    if (!err) return false;
    return err.code === '42703' || /column/i.test(err.message || '');
}

function isUniqueConstraintError(err, constraintName = null) {
    if (!err || err.code !== '23505') return false;
    if (!constraintName) return true;
    const details = `${err.message || ''} ${err.details || ''} ${err.constraint || ''}`;
    return details.includes(constraintName);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: get role id by name — creates the role if it doesn't exist
// ─────────────────────────────────────────────────────────────────────────────
async function getRoleId(roleName) {
    // 1. Try to find existing role
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .maybeSingle();

    if (data) return data.id;

    // 2. Role missing — try to upsert it
    console.warn(`[getRoleId] Role "${roleName}" not found, attempting to create it...`);
    const { data: created, error: createErr } = await supabase
        .from('roles')
        .insert({ name: roleName, description: `${roleName} — auto-created` })
        .select('id')
        .single();

    if (created) return created.id;

    // 3. If upsert also fails (e.g. race condition), try one more select
    const { data: retry } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .maybeSingle();

    if (retry) return retry.id;

    throw new AppError(`Role "${roleName}" not found and could not be created. Run migrations first.`, 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: generate readable temp password
// ─────────────────────────────────────────────────────────────────────────────
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '@#$!';
    let pwd = special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 9; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE HOSPITAL  (Super Admin only)
// POST /api/super-admin/hospitals
// ─────────────────────────────────────────────────────────────────────────────
export async function createHospital(req, res, next) {
    const {
        hospitalName,
        hospitalCode,
        type,
        address,
        district,
        city,
        contactEmail,
        contactPhone,
        licenseNo,
        planType   = 'MONTHLY',
        startDate,
        renewalDate,
        price,
        adminName,
        adminPhone,
        username,
        password,
        permissions = {},
        status = 'ACTIVE'
    } = req.body;

    try {
        const adminEmail = (contactEmail || '').trim().toLowerCase();

        // 1. Ensure hospital_code is unique
        const { data: existing } = await supabase
            .from('hospitals')
            .select('id')
            .eq('hospital_code', hospitalCode.toUpperCase())
            .maybeSingle();

        if (existing) throw new AppError('Hospital code already exists. Codes are unique and immutable.', 409);

        // 2. Ensure admin email is unique before creating hospital
        const { data: existingAdminUser, error: existingAdminErr } = await supabase
            .from('users')
            .select('id, hospital_id, roles(name)')
            .eq('email', adminEmail)
            .maybeSingle();

        if (existingAdminErr) {
            throw new AppError('Failed to validate hospital admin email: ' + existingAdminErr.message, 500);
        }
        if (existingAdminUser) {
            const existingRole = existingAdminUser.roles?.name || 'another';
            throw new AppError(
                `Admin email already exists. This email is already linked to a ${existingRole} account.`,
                409
            );
        }

        // 3. Insert hospital row
        let hospital = null;
        const fullHospitalPayload = {
            hospital_name:   hospitalName,
            hospital_code:   hospitalCode.toUpperCase(),
            type:            type.toUpperCase(),
            address,
            district,
            city:            city || null,
            contact_email:   adminEmail,
            contact_phone:   contactPhone,
            license_no:      licenseNo || null,
            plan_type:       planType.toUpperCase(),
            plan_start_date: startDate || null,
            renewal_date:    renewalDate || null,
            plan_price:      price || null,
            is_active:       status === 'ACTIVE',
            created_by:      req.user.id,
            created_at:      new Date().toISOString(),
            updated_at:      new Date().toISOString()
        };

        let { data: hospitalFull, error: hospErr } = await supabase
            .from('hospitals')
            .insert(fullHospitalPayload)
            .select()
            .single();

        if (!hospErr) {
            hospital = hospitalFull;
        } else if (isMissingColumnError(hospErr)) {
            // Backward-compatible fallback for older hospital schemas.
            const minimalHospitalPayload = {
                hospital_name: hospitalName,
                hospital_code: hospitalCode.toUpperCase(),
                type:          type.toUpperCase(),
                address,
                district,
                contact_email: adminEmail,
                contact_phone: contactPhone,
                is_active:     status === 'ACTIVE',
                created_by:    req.user.id,
                created_at:    new Date().toISOString(),
                updated_at:    new Date().toISOString()
            };

            const { data: hospitalBasic, error: basicErr } = await supabase
                .from('hospitals')
                .insert(minimalHospitalPayload)
                .select()
                .single();

            if (basicErr) throw new AppError('Failed to create hospital: ' + basicErr.message, 500);
            hospital = hospitalBasic;
        } else {
            throw new AppError('Failed to create hospital: ' + hospErr.message, 500);
        }

        // 4. Generate Hospital Admin credentials
        const tempPassword = password || generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        const adminFullName = adminName || `${hospitalName} Admin`;
        const adminUsername = username || `admin_${hospitalCode.toLowerCase()}`;

        const hospitalAdminRoleId = await getRoleId('HOSPITAL_ADMIN');

        // 4. Create user account for Hospital Admin
        // Try with extended columns (username, permissions) first; fall back without them
        let adminUser = null;
        const baseUserPayload = {
            email:         adminEmail,
            password_hash: passwordHash,
            phone:         adminPhone || contactPhone,
            full_name:     adminFullName,
            role_id:       hospitalAdminRoleId,
            hospital_id:   hospital.id,
            is_active:     status === 'ACTIVE',
            is_verified:   true,
            created_at:    new Date().toISOString(),
            updated_at:    new Date().toISOString()
        };

        const { data: adminUserFull, error: userErrFull } = await supabase
            .from('users')
            .insert({ ...baseUserPayload, username: adminUsername, permissions })
            .select('id, email, username')
            .single();

        if (userErrFull) {
            // If it failed due to missing columns, retry without username/permissions
            const isColError = userErrFull.message && (
                userErrFull.message.includes('username') ||
                userErrFull.message.includes('permissions') ||
                userErrFull.message.includes('column') ||
                userErrFull.code === '42703'
            );
            if (isUniqueConstraintError(userErrFull, 'users_email_key')) {
                await supabase.from('hospitals').delete().eq('id', hospital.id);
                throw new AppError('Admin email already exists. Use a different email.', 409);
            }
            if (!isColError) {
                await supabase.from('hospitals').delete().eq('id', hospital.id);
                throw new AppError('Failed to create hospital admin user: ' + userErrFull.message, 500);
            }
            // Fallback: insert without extended columns
            const { data: adminUserBasic, error: userErrBasic } = await supabase
                .from('users')
                .insert(baseUserPayload)
                .select('id, email')
                .single();
            if (userErrBasic) {
                if (isUniqueConstraintError(userErrBasic, 'users_email_key')) {
                    await supabase.from('hospitals').delete().eq('id', hospital.id);
                    throw new AppError('Admin email already exists. Use a different email.', 409);
                }
                await supabase.from('hospitals').delete().eq('id', hospital.id);
                throw new AppError('Failed to create hospital admin user: ' + userErrBasic.message, 500);
            }
            adminUser = { ...adminUserBasic, username: adminUsername };
        } else {
            adminUser = adminUserFull;
        }

        // 5. Send credentials via email
        const emailSent = await sendHospitalAdminCredentials({
            to: adminEmail,
            hospitalName,
            hospitalCode: hospital.hospital_code,
            loginEmail: adminEmail,
            tempPassword,
            adminName: adminFullName
        });

        // 6. Audit log
        await createActivityLog({
            hospitalId: hospital.id,
            userId: req.user.id,
            action: 'HOSPITAL_CREATED',
            entityType: 'hospital',
            entityId: hospital.id,
            ipAddress: req.ip,
            metadata: { hospitalName, hospitalCode: hospital.hospital_code, adminUserId: adminUser.id }
        });

        res.status(201).json({
            success: true,
            message: 'Hospital created successfully. Admin credentials sent via email.',
            data: {
                hospital,
                adminUser: { id: adminUser.id, email: adminUser.email, username: adminUser.username },
                emailSent
            }
        });

    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL HOSPITALS  (Super Admin — sees all)
// GET /api/super-admin/hospitals?search=&district=&type=&status=
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllHospitals(req, res, next) {
    const { search, district, type, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        let query = supabase
            .from('hospitals')
            .select('*', { count: 'exact' })
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('created_at', { ascending: false });

        if (search) {
            query = query.or(
                `hospital_name.ilike.%${search}%,hospital_code.ilike.%${search}%,district.ilike.%${search}%`
            );
        }
        if (district && district !== 'all') query = query.eq('district', district);
        if (type && type !== 'all')         query = query.eq('type', type.toUpperCase());
        if (status === 'active')            query = query.eq('is_active', true);
        if (status === 'inactive')          query = query.eq('is_active', false);

        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to fetch hospitals: ' + error.message, 500);

        // Get staff counts per hospital
        const hospitalIds = (data || []).map(h => h.id);
        let staffCounts = {};
        if (hospitalIds.length > 0) {
            const { data: staffData } = await supabase
                .from('staff_profiles')
                .select('hospital_id')
                .in('hospital_id', hospitalIds)
                .eq('is_deleted', false)
                .eq('is_active', true);
            (staffData || []).forEach(s => {
                staffCounts[s.hospital_id] = (staffCounts[s.hospital_id] || 0) + 1;
            });
        }

        const enriched = (data || []).map(h => ({
            ...h,
            staff_count: staffCounts[h.id] || 0
        }));

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
// GET SINGLE HOSPITAL
// GET /api/super-admin/hospitals/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalById(req, res, next) {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', id)
            .eq('is_deleted', false)
            .single();

        if (error || !data) throw new AppError('Hospital not found', 404);

        // Fetch admin user
        const adminRoleId = await getRoleId('HOSPITAL_ADMIN');
        const { data: adminUser } = await supabase
            .from('users')
            .select('id, email, full_name, username, permissions, is_active, created_at')
            .eq('hospital_id', id)
            .eq('role_id', adminRoleId)
            .eq('is_deleted', false)
            .maybeSingle();

        res.status(200).json({ success: true, data: { ...data, adminUser } });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ADMIN FOR HOSPITAL (by hospital code or id)
// GET /api/super-admin/hospitals/:idOrCode/admin
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalAdmin(req, res, next) {
    const { idOrCode } = req.params;
    try {
        // Try as ID first, then as code
        let hospitalId = idOrCode;
        const isUUID = /^[0-9a-f-]{36}$/i.test(idOrCode);
        if (!isUUID) {
            const { data: hosp } = await supabase
                .from('hospitals')
                .select('id')
                .eq('hospital_code', idOrCode.toUpperCase())
                .eq('is_deleted', false)
                .maybeSingle();
            if (!hosp) throw new AppError('Hospital not found', 404);
            hospitalId = hosp.id;
        }

        const adminRoleId = await getRoleId('HOSPITAL_ADMIN');
        const { data: adminUser } = await supabase
            .from('users')
            .select('id, email, full_name, username, phone, permissions, is_active')
            .eq('hospital_id', hospitalId)
            .eq('role_id', adminRoleId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (!adminUser) {
            return res.status(200).json({ success: true, data: null, message: 'No admin found for this hospital' });
        }

        res.status(200).json({
            success: true,
            data: {
                name:        adminUser.full_name,
                email:       adminUser.email,
                phone:       adminUser.phone,
                username:    adminUser.username,
                permissions: adminUser.permissions || {},
            }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ADMIN FOR HOSPITAL (by hospital code or id)
// PUT /api/super-admin/hospitals/:idOrCode/admin
// ─────────────────────────────────────────────────────────────────────────────
export async function updateHospitalAdmin(req, res, next) {
    const { idOrCode } = req.params;
    const { name, email, phone, username, password, permissions } = req.body;

    try {
        let hospitalId = idOrCode;
        const isUUID = /^[0-9a-f-]{36}$/i.test(idOrCode);
        if (!isUUID) {
            const { data: hosp } = await supabase
                .from('hospitals')
                .select('id, hospital_name')
                .eq('hospital_code', idOrCode.toUpperCase())
                .eq('is_deleted', false)
                .maybeSingle();
            if (!hosp) throw new AppError('Hospital not found', 404);
            hospitalId = hosp.id;
        }

        const adminRoleId = await getRoleId('HOSPITAL_ADMIN');
        const { data: adminUser } = await supabase
            .from('users')
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('role_id', adminRoleId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (!adminUser) throw new AppError('No admin found for this hospital', 404);

        const updatePayload = { updated_at: new Date().toISOString() };
        if (name)        updatePayload.full_name    = name;
        if (email)       updatePayload.email        = email.toLowerCase();
        if (phone)       updatePayload.phone        = phone;
        if (username)    updatePayload.username     = username;
        if (permissions) updatePayload.permissions  = permissions;
        if (password && password.trim()) {
            updatePayload.password_hash = await bcrypt.hash(password, 12);
        }

        const { error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', adminUser.id);

        if (error) throw new AppError('Failed to update admin: ' + error.message, 500);

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'HOSPITAL_ADMIN_UPDATED',
            entityType: 'user',
            entityId: adminUser.id,
            ipAddress: req.ip,
            metadata: { name, email, username }
        });

        res.status(200).json({ success: true, message: 'Hospital admin updated successfully' });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE HOSPITAL  (all fields EXCEPT hospital_code)
// PUT /api/super-admin/hospitals/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function updateHospital(req, res, next) {
    const { id } = req.params;
    const {
        hospitalName, type, address, district, city,
        contactEmail, contactPhone, licenseNo,
        planType, startDate, renewalDate, price, isActive
    } = req.body;

    try {
        const { data: existing, error: fetchErr } = await supabase
            .from('hospitals')
            .select('id, hospital_code')
            .eq('id', id)
            .eq('is_deleted', false)
            .single();

        if (fetchErr || !existing) throw new AppError('Hospital not found', 404);

        const updatePayload = { updated_at: new Date().toISOString() };
        if (hospitalName !== undefined) updatePayload.hospital_name   = hospitalName;
        if (type !== undefined)         updatePayload.type            = type.toUpperCase();
        if (address !== undefined)      updatePayload.address         = address;
        if (district !== undefined)     updatePayload.district        = district;
        if (city !== undefined)         updatePayload.city            = city;
        if (contactEmail !== undefined) updatePayload.contact_email   = contactEmail;
        if (contactPhone !== undefined) updatePayload.contact_phone   = contactPhone;
        if (licenseNo !== undefined)    updatePayload.license_no      = licenseNo;
        if (planType !== undefined)     updatePayload.plan_type       = planType?.toUpperCase();
        if (startDate !== undefined)    updatePayload.plan_start_date = startDate;
        if (renewalDate !== undefined)  updatePayload.renewal_date    = renewalDate;
        if (price !== undefined)        updatePayload.plan_price      = price;
        if (isActive !== undefined)     updatePayload.is_active       = isActive;

        const { data, error } = await supabase
            .from('hospitals')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new AppError('Failed to update hospital: ' + error.message, 500);

        await createActivityLog({
            hospitalId: id,
            userId: req.user.id,
            action: 'HOSPITAL_UPDATED',
            entityType: 'hospital',
            entityId: id,
            ipAddress: req.ip,
            metadata: updatePayload
        });

        res.status(200).json({ success: true, message: 'Hospital updated', data });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE HOSPITAL STATUS
// PATCH /api/super-admin/hospitals/:id/toggle-status
// ─────────────────────────────────────────────────────────────────────────────
export async function toggleHospitalStatus(req, res, next) {
    const { id } = req.params;
    try {
        const { data: hospital, error: fetchErr } = await supabase
            .from('hospitals')
            .select('id, is_active, hospital_name')
            .eq('id', id)
            .eq('is_deleted', false)
            .single();

        if (fetchErr || !hospital) throw new AppError('Hospital not found', 404);

        const newStatus = !hospital.is_active;

        const { error } = await supabase
            .from('hospitals')
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw new AppError('Failed to toggle status', 500);

        await supabase
            .from('users')
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq('hospital_id', id);

        await createActivityLog({
            hospitalId: id,
            userId: req.user.id,
            action: newStatus ? 'HOSPITAL_ACTIVATED' : 'HOSPITAL_DEACTIVATED',
            entityType: 'hospital',
            entityId: id,
            ipAddress: req.ip,
            metadata: { newStatus, hospitalName: hospital.hospital_name }
        });

        res.status(200).json({
            success: true,
            message: `Hospital ${newStatus ? 'activated' : 'deactivated'}`,
            data: { isActive: newStatus }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE HOSPITAL
// DELETE /api/super-admin/hospitals/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function softDeleteHospital(req, res, next) {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('hospitals')
            .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw new AppError('Failed to delete hospital', 500);

        await supabase
            .from('users')
            .update({ is_active: false, is_deleted: true, updated_at: new Date().toISOString() })
            .eq('hospital_id', id);

        await createActivityLog({
            hospitalId: id,
            userId: req.user.id,
            action: 'HOSPITAL_SOFT_DELETED',
            entityType: 'hospital',
            entityId: id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Hospital soft-deleted' });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HOSPITALS CSV
// GET /api/super-admin/hospitals/export/csv
// ─────────────────────────────────────────────────────────────────────────────
export async function exportHospitalsCSV(req, res, next) {
    try {
        const { data: hospitals, error } = await supabase
            .from('hospitals')
            .select('hospital_name, hospital_code, type, district, contact_email, contact_phone, plan_type, renewal_date, is_active, created_at')
            .eq('is_deleted', false)
            .order('hospital_name');

        if (error) throw new AppError('Failed to export hospitals', 500);

        const header = 'Name,Code,Type,District,Email,Phone,Plan,Renewal,Active,Created';
        const rows = (hospitals || []).map(h =>
            [
                `"${h.hospital_name || ''}"`,
                h.hospital_code || '',
                h.type || '',
                `"${h.district || ''}"`,
                h.contact_email || '',
                h.contact_phone || '',
                h.plan_type || '',
                h.renewal_date || '',
                h.is_active ? 'Yes' : 'No',
                h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN') : ''
            ].join(',')
        );

        const csv = [header, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="hospitals.csv"');
        res.status(200).send(csv);
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SUPER ADMIN ANALYTICS
// GET /api/super-admin/hospitals/analytics
// ─────────────────────────────────────────────────────────────────────────────
export async function getHospitalAnalytics(req, res, next) {
    try {
        const { data: hospitals, error } = await supabase
            .from('hospitals')
            .select('id, type, district, is_active')
            .eq('is_deleted', false);

        if (error) throw new AppError('Failed to fetch analytics', 500);

        const total    = (hospitals || []).length;
        const active   = (hospitals || []).filter(h => h.is_active).length;
        const inactive = total - active;

        const byType = (hospitals || []).reduce((acc, h) => {
            acc[h.type] = (acc[h.type] || 0) + 1; return acc;
        }, {});

        const byDistrict = (hospitals || []).reduce((acc, h) => {
            if (h.district) acc[h.district] = (acc[h.district] || 0) + 1; return acc;
        }, {});

        const { count: totalAdmins } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .not('hospital_id', 'is', null)
            .eq('is_deleted', false)
            .eq('is_active', true);

        res.status(200).json({
            success: true,
            data: {
                totalHospitals: total,
                activeHospitals: active,
                inactiveHospitals: inactive,
                activeAdmins: totalAdmins || 0,
                byType,
                byDistrict: Object.entries(byDistrict)
                    .sort(([,a],[,b]) => b - a)
                    .slice(0, 10)
                    .map(([district, count]) => ({ district, count }))
            }
        });
    } catch (error) {
        next(error);
    }
}
