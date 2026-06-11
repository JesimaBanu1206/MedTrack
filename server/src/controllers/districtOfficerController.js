/**
 * districtOfficerController.js (extension to superAdminController)
 * Super Admin creates district officer accounts and sends credentials by email
 */

import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { transporter } from '../config/mailer.js';
import { config } from '../config/env.js';

// ── Helper: get/create DISTRICT_OFFICER role id ───────────────────────────────
async function getDistrictOfficerRoleId() {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'DISTRICT_OFFICER')
        .maybeSingle();

    if (!data) {
        // Create role if doesn't exist
        const { data: newRole, error: rErr } = await supabase
            .from('roles')
            .insert({ name: 'DISTRICT_OFFICER' })
            .select('id')
            .single();
        if (rErr) throw new AppError('Failed to create role', 500);
        return newRole.id;
    }
    return data.id;
}

function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
}

async function insertDistrictOfficerUser(basePayload, dob) {
    const variants = [];

    if (dob) {
        variants.push({ ...basePayload, dob });
        variants.push({ ...basePayload, date_of_birth: dob });
    } else {
        variants.push({ ...basePayload });
    }

    let lastError = null;

    for (const payload of variants) {
        const { data, error } = await supabase
            .from('users')
            .insert(payload)
            .select('id, email')
            .single();

        if (!error) return { data, error: null };
        lastError = error;

        // Retry with alternate DOB column names when schemas differ.
        if (dob) continue;
        break;
    }

    if (dob) {
        const { data, error } = await supabase
            .from('users')
            .insert(basePayload)
            .select('id, email')
            .single();

        if (!error) return { data, error: null };
        lastError = error;
    }

    return { data: null, error: lastError };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DISTRICT OFFICER
// POST /api/super-admin/district-officers
// ─────────────────────────────────────────────────────────────────────────────
export async function createDistrictOfficer(req, res, next) {
    const { fullName, email, phone, dob, district, designation, password } = req.body;
    try {
        if (!fullName || !email || !district) {
            throw new AppError('fullName, email, and district are required', 400);
        }

        const suppliedPassword = typeof password === 'string' ? password.trim() : '';
        if (suppliedPassword && suppliedPassword.length < 8) {
            throw new AppError('Password must be at least 8 characters', 400);
        }

        // Check email uniqueness
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
        if (existing) throw new AppError('Email already in use', 409);

        const finalPassword = suppliedPassword || generateTempPassword();
        const isManualPassword = Boolean(suppliedPassword);
        const passwordHash = await bcrypt.hash(finalPassword, 12);
        const roleId = await getDistrictOfficerRoleId();

        // Create user
        const basePayload = {
            email: email.toLowerCase(),
            password_hash: passwordHash,
            phone: phone || null,
            full_name: fullName,
            role_id: roleId,
            district: district,
            designation: designation || 'District Health Officer',
            is_active: true,
            is_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { data: newUser, error: userErr } = await insertDistrictOfficerUser(basePayload, dob || null);

        if (userErr) throw new AppError('Failed to create user: ' + userErr.message, 500);

        const passwordLabel = isManualPassword ? 'Password' : 'Temporary Password';
        const passwordNote = isManualPassword
            ? 'Use this password to sign in. Keep it confidential and rotate periodically.'
            : 'Please change your password after your first login. This password is temporary and should not be shared.';

        // Send credentials email
        let emailSent = false;
        try {
            await transporter.sendMail({
                from: `"MedTrack Admin" <${config.smtp.user}>`,
                to: email,
                subject: 'MedTrack - District Health Officer Access Credentials',
                html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.1); }
    .header { background: linear-gradient(135deg, #1e3a5f, #1a56db); color: white; padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0 0 8px; font-size: 26px; }
    .header p { margin: 0; opacity: .8; font-size: 14px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 12px; }
    .info-row { display: flex; gap: 10px; margin-bottom: 8px; font-size: 14px; }
    .label { color: #6b7280; min-width: 130px; }
    .value { color: #111; font-weight: 600; }
    .cred-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }
    .cred-box h3 { margin: 0 0 14px; color: #1e40af; font-size: 15px; }
    .cred-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 14px; }
    .cred-label { color: #6b7280; min-width: 90px; }
    .cred-value { font-family: monospace; font-size: 16px; font-weight: 800; color: #1a56db; background: #fff; padding: 6px 14px; border-radius: 6px; border: 1px solid #bfdbfe; }
    .url-box { background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin: 12px 0; text-align: center; font-size: 14px; color: #065f46; font-weight: 600; }
    .note { background: #fff8f0; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #92400e; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏛️ MedTrack</h1>
      <p>Tamil Nadu District Health Monitoring System</p>
    </div>
    <div class="body">
      <div class="greeting">Welcome, ${fullName}!</div>
      <p style="color:#374151;font-size:14px;margin-bottom:20px">
        Your District Health Officer account has been created on the MedTrack platform. You have been assigned monitoring access for <strong>${district} District</strong>.
      </p>

      <div class="info-row"><span class="label">Full Name</span><span class="value">${fullName}</span></div>
      <div class="info-row"><span class="label">Designation</span><span class="value">${designation || 'District Health Officer'}</span></div>
      <div class="info-row"><span class="label">Assigned District</span><span class="value">${district}</span></div>
      ${dob ? `<div class="info-row"><span class="label">Date of Birth</span><span class="value">${dob}</span></div>` : ''}

      <div class="cred-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="cred-row"><span class="cred-label">Email</span><span class="cred-value">${email}</span></div>
        <div class="cred-row"><span class="cred-label">${passwordLabel}</span><span class="cred-value">${finalPassword}</span></div>
      </div>

      <div class="url-box">
        🌐 Login at: <a href="${config.clientUrl || 'http://localhost:5173'}/district" style="color:#1a56db">${config.clientUrl || 'http://localhost:5173'}/district</a>
      </div>

      <div class="note">
        ⚠️ <strong>Important:</strong> ${passwordNote} You can only view data for <strong>${district} District</strong>.
      </div>
    </div>
    <div class="footer">© ${new Date().getFullYear()} MedTrack Healthcare Platform — Tamil Nadu Health Department</div>
  </div>
</body>
</html>`
            });
            emailSent = true;
        } catch (emailErr) {
            console.error('Email send failed:', emailErr.message);
        }

        res.status(201).json({
            success: true,
            message: `District Officer created${emailSent ? '. Credentials sent via email.' : ' (email failed — check SMTP config).'}`,
            data: {
                id: newUser.id,
                email: newUser.email,
                fullName, district, designation,
                emailSent,
                passwordMode: isManualPassword ? 'CUSTOM' : 'AUTO_GENERATED',
                tempPassword: !isManualPassword && config.nodeEnv === 'development' ? finalPassword : undefined
            }
        });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL DISTRICT OFFICERS
// GET /api/super-admin/district-officers
// ─────────────────────────────────────────────────────────────────────────────
export async function getDistrictOfficers(req, res, next) {
    try {
        const roleId = await getDistrictOfficerRoleId();

        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, phone, district, designation, is_active, created_at')
            .eq('role_id', roleId)
            .eq('is_deleted', false)
            .order('district');

        if (error) throw new AppError('Failed to fetch district officers: ' + error.message, 500);
        res.status(200).json({ success: true, data: data || [] });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE / TOGGLE DISTRICT OFFICER
// PATCH /api/super-admin/district-officers/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDistrictOfficer(req, res, next) {
    const { id } = req.params;
    const { isActive, designation, district } = req.body;
    try {
        const updates = { updated_at: new Date().toISOString() };
        if (isActive !== undefined) updates.is_active = isActive;
        if (designation) updates.designation = designation;
        if (district) updates.district = district;

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new AppError('Update failed: ' + error.message, 500);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET DISTRICT OFFICER PASSWORD
// POST /api/super-admin/district-officers/:id/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export async function resetDistrictOfficerPassword(req, res, next) {
    const { id } = req.params;
    try {
        const { data: user } = await supabase
            .from('users')
            .select('email, full_name, district')
            .eq('id', id)
            .single();

        if (!user) throw new AppError('User not found', 404);

        const newPassword = generateTempPassword();
        const hash = await bcrypt.hash(newPassword, 12);

        await supabase.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', id);

        // Send new password by email
        try {
            await transporter.sendMail({
                from: `"MedTrack Admin" <${config.smtp.user}>`,
                to: user.email,
                subject: 'MedTrack — Password Reset',
                html: `<p>Hello ${user.full_name},</p><p>Your MedTrack password has been reset.<br><strong>New Password: ${newPassword}</strong></p><p>Please change it after logging in.</p>`
            });
        } catch (e) { console.error('Email fail:', e.message); }

        res.status(200).json({
            success: true,
            message: 'Password reset and sent via email',
            newPassword: config.nodeEnv === 'development' ? newPassword : undefined
        });
    } catch (err) { next(err); }
}
