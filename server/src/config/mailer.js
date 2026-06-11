import nodemailer from 'nodemailer';
import { config } from './env.js';

export const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
    }
});

export const sendOTPEmail = async (email, otp, name = 'User') => {
    try {
        const mailOptions = {
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to: email,
            subject: 'MedTrack - OTP Verification Code',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 MedTrack</h1>
              <p>Healthcare Platform</p>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Your OTP verification code is:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p><strong>This code will expire in 10 minutes.</strong></p>
              <p>If you didn't request this code, please ignore this email.</p>
              <p>For security reasons, never share this code with anyone.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 MedTrack Healthcare Platform. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email send failed:', error.message);
        return false;
    }
};

export const sendWelcomeEmail = async (email, name) => {
    try {
        const mailOptions = {
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to: email,
            subject: 'Welcome to MedTrack Healthcare Platform',
            html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #667eea;">Welcome to MedTrack, ${name}! 🎉</h2>
            <p>Your account has been successfully verified.</p>
            <p>You can now access all features of our healthcare platform.</p>
            <p>Thank you for choosing MedTrack!</p>
            <hr>
            <p style="font-size: 12px; color: #666;">MedTrack Healthcare Platform</p>
          </div>
        </body>
        </html>
      `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('❌ Welcome email failed:', error.message);
        return false;
    }
};

// ── Hospital Admin Credentials ──────────────────────────────────────────────
export const sendHospitalAdminCredentials = async ({ to, hospitalName, hospitalCode, loginEmail, tempPassword, adminName }) => {
    try {
        await transporter.sendMail({
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to,
            subject: `MedTrack – Hospital Admin Access: ${hospitalName}`,
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1a56db,#0e9f6e);padding:30px;text-align:center">
    <h1 style="color:white;margin:0">🏥 MedTrack Hospital Admin</h1>
  </div>
  <div style="padding:30px">
    <h2>Welcome, ${adminName}!</h2>
    <p>Your hospital has been registered on MedTrack. Here are your login credentials:</p>
    <table style="background:#f8fafc;border-radius:8px;padding:16px;width:100%;border-collapse:collapse">
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Hospital</td><td style="padding:8px">${hospitalName}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Code</td><td style="padding:8px;font-family:monospace;font-weight:bold;color:#1a56db">${hospitalCode}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Login Email</td><td style="padding:8px">${loginEmail}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Temp Password</td><td style="padding:8px;font-family:monospace;font-weight:bold;background:#fef9c3;padding:6px 12px;border-radius:4px">${tempPassword}</td></tr>
    </table>
    <p style="color:#dc2626;font-size:14px;margin-top:16px"><strong>⚠️ Please change your password after first login.</strong></p>
    <p style="font-size:13px;color:#64748b">This is a system-generated email. Keep your credentials secure.</p>
  </div>
</div></body></html>`
        });
        return true;
    } catch (err) {
        console.error('❌ Hospital admin email failed:', err.message);
        return false;
    }
};

// ── Staff Credentials ──────────────────────────────────────────────────────
export const sendStaffCredentials = async ({ to, staffName, hospitalName, loginEmail, tempPassword, staffRole }) => {
    try {
        await transporter.sendMail({
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to,
            subject: `MedTrack – Staff Login Credentials`,
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1a56db,#7c3aed);padding:30px;text-align:center">
    <h1 style="color:white;margin:0">🩺 MedTrack Staff Access</h1>
  </div>
  <div style="padding:30px">
    <h2>Hello, ${staffName}!</h2>
    <p>You have been registered as <strong>${staffRole}</strong> at <strong>${hospitalName}</strong>.</p>
    <table style="background:#f8fafc;border-radius:8px;padding:16px;width:100%;border-collapse:collapse">
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Hospital</td><td style="padding:8px">${hospitalName}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Role</td><td style="padding:8px">${staffRole}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Login Email</td><td style="padding:8px">${loginEmail}</td></tr>
      <tr><td style="padding:8px;color:#64748b;font-weight:bold">Temp Password</td><td style="padding:8px;font-family:monospace;font-weight:bold;background:#fef9c3;padding:6px 12px;border-radius:4px">${tempPassword}</td></tr>
    </table>
    <p style="color:#dc2626;font-size:14px;margin-top:16px"><strong>⚠️ Change your password after first login.</strong></p>
  </div>
</div></body></html>`
        });
        return true;
    } catch (err) {
        console.error('❌ Staff credentials email failed:', err.message);
        return false;
    }
};

// ── Password Reset Email ───────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ to, name, token, expiresInMinutes }) => {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    try {
        await transporter.sendMail({
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to,
            subject: 'MedTrack – Password Reset Request',
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:30px;text-align:center">
    <h1 style="color:white;margin:0">🔐 Password Reset</h1>
  </div>
  <div style="padding:30px">
    <h2>Hello ${name},</h2>
    <p>We received a request to reset your MedTrack password.</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${resetUrl}" style="background:#1a56db;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reset Password</a>
    </div>
    <p style="font-size:13px;color:#64748b">This link expires in ${expiresInMinutes} minutes.</p>
    <p style="font-size:13px;color:#64748b">If you didn't request this, ignore this email.</p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all">Or copy: ${resetUrl}</p>
  </div>
</div></body></html>`
        });
        return true;
    } catch (err) {
        console.error('❌ Password reset email failed:', err.message);
        return false;
    }
};


export const sendAppointmentConfirmationEmail = async ({
    to,
    patientName = 'Patient',
    patientPid = null,
    appointmentType = 'IN_PERSON',
    hospitalName = null,
    department = null,
    visitDate = null,
    visitTime = null,
    tokenNumber = null,
    doctorName = null,
    fee = null
}) => {
    try {
        const isOnline = String(appointmentType).toUpperCase() === 'ONLINE';
        const subject = isOnline
            ? 'MedTrack - Online Consultation Confirmed'
            : 'MedTrack - Appointment Confirmed';

        await transporter.sendMail({
            from: `"MedTrack Healthcare" <${config.smtp.user}>`,
            to,
            subject,
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:620px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1a56db,#0e9f6e);padding:26px;text-align:center">
    <h1 style="color:white;margin:0">MedTrack Appointment Confirmation</h1>
  </div>
  <div style="padding:26px">
    <p style="margin-top:0">Hello <strong>${patientName}</strong>,</p>
    <p>Your ${isOnline ? 'online consultation' : 'hospital appointment'} has been booked successfully.</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Patient ID</td><td style="padding:10px">${patientPid || 'N/A'}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Type</td><td style="padding:10px">${isOnline ? 'Online Consultation' : 'In-Person Appointment'}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Hospital</td><td style="padding:10px">${hospitalName || 'Will be assigned by hospital desk'}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Department</td><td style="padding:10px">${department || 'General Medicine'}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Date</td><td style="padding:10px">${visitDate || 'N/A'}</td></tr>
      <tr><td style="padding:10px;font-weight:bold;color:#64748b">Time</td><td style="padding:10px">${visitTime || 'N/A'}</td></tr>
      ${tokenNumber ? `<tr><td style="padding:10px;font-weight:bold;color:#64748b">Token Number</td><td style="padding:10px">#${tokenNumber}</td></tr>` : ''}
      ${doctorName ? `<tr><td style="padding:10px;font-weight:bold;color:#64748b">Doctor</td><td style="padding:10px">${doctorName}</td></tr>` : ''}
      ${fee != null ? `<tr><td style="padding:10px;font-weight:bold;color:#64748b">Consultation Fee</td><td style="padding:10px">INR ${fee}</td></tr>` : ''}
    </table>
    <p style="margin-top:16px;color:#334155;font-size:14px">
      ${isOnline ? 'Please join your session 10 minutes early using the consultation link from your doctor dashboard.' : 'Please arrive at the hospital reception before your slot and show your patient ID/token.'}
    </p>
    <p style="font-size:12px;color:#94a3b8;margin-top:18px">This is an automated confirmation from MedTrack.</p>
  </div>
</div></body></html>`
        });

        return true;
    } catch (err) {
        console.error('Appointment confirmation email failed:', err.message);
        return false;
    }
};
