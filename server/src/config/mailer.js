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
