import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';
import { config } from '../config/env.js';
import { sendOTPEmail } from '../utils/mailer.js';
import { generateOTP } from '../utils/otpUtils.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { generatePatientId } from '../utils/patientIdGenerator.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';
import { AppError } from '../utils/errors.js';

/**
 * PATIENT REGISTRATION
 * 1. Validate inputs
 * 2. Hash password
 * 3. Create user account (unverified)
 * 4. Generate and send OTP
 */
export async function register(req, res, next) {
    const { fullName, email, phone, password } = req.body;

    try {
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, is_verified, phone, email')
            .or(`phone.eq.${phone},email.eq.${email}`)
            .single();

        if (existingUser) {
            if (existingUser.is_verified) {
                throw new AppError('User already exists and is verified. Please login.', 409);
            }
            // If user exists but not verified, allow re-registration
            // Delete old unverified account
            await supabase
                .from('users')
                .delete()
                .eq('id', existingUser.id);
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Get PATIENT role ID
        const { data: patientRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'PATIENT')
            .single();

        if (!patientRole) {
            throw new AppError('Patient role not found in database', 500);
        }

        // Create user account (unverified)
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
                email: email || null,
                phone,
                password_hash: passwordHash,
                role_id: patientRole.id,
                is_verified: false,
                is_active: true
            })
            .select()
            .single();

        if (userError) {
            console.error('User creation error:', userError);
            throw new AppError('Failed to create user account', 500);
        }

        // Create patient record with basic info
        const { error: patientError } = await supabase
            .from('patients')
            .insert({
                user_id: newUser.id,
                full_name: fullName,
                patient_id: 'PENDING-' + newUser.id.substring(0, 8), // Temporary ID until verified
                dob: new Date().toISOString().split('T')[0] // Temporary DOB until profile completion
            });

        if (patientError) {
            console.error('Patient creation error:', patientError);
            // Rollback user creation
            await supabase.from('users').delete().eq('id', newUser.id);
            throw new AppError('Failed to create patient profile', 500);
        }

        // Generate 6-digit OTP
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store OTP in database
        const { error: otpError } = await supabase
            .from('otps')
            .insert({
                user_id: newUser.id,
                phone,
                otp_code: otpCode,
                purpose: 'REGISTRATION',
                expires_at: expiresAt.toISOString()
            });

        if (otpError) {
            console.error('OTP creation error:', otpError);
            throw new AppError('Failed to generate OTP', 500);
        }

        // Send OTP via email
        if (email) {
            try {
                await sendOTPEmail(email, otpCode, fullName);

                // Audit log
                await createAuditLog({
                    userId: newUser.id,
                    action: AUDIT_ACTIONS.USER_REGISTER,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: { phone, email, fullName },
                    status: 'SUCCESS'
                });

                await createAuditLog({
                    userId: newUser.id,
                    action: AUDIT_ACTIONS.OTP_SENT,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: { purpose: 'REGISTRATION', email },
                    status: 'SUCCESS'
                });
            } catch (emailError) {
                console.error('Email sending error:', emailError);
                // Don't fail registration if email fails
                // In production, you might want to queue this for retry
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify OTP sent to your email.',
            data: {
                userId: newUser.id,
                email: email || null,
                phone,
                otpExpiresAt: expiresAt
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * OTP VERIFICATION
 * 1. Validate OTP
 * 2. Check expiration
 * 3. Mark user as verified
 * 4. Delete used OTP
 */
export async function verifyOTP(req, res, next) {
    const { phone, otp } = req.body;

    try {
        // Find user by phone
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, phone, role_id, is_verified')
            .eq('phone', phone)
            .single();

        if (userError || !user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_verified) {
            throw new AppError('User already verified. Please login.', 400);
        }

        // Find valid OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('otps')
            .select('*')
            .eq('user_id', user.id)
            .eq('otp_code', otp)
            .eq('is_used', false)
            .eq('purpose', 'REGISTRATION')
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) {
            // Increment failed attempts
            await createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.OTP_FAILED,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { phone, reason: 'Invalid or expired OTP' },
                status: 'FAILURE'
            });

            throw new AppError('Invalid or expired OTP. Please request a new one.', 400);
        }

        // Mark user as verified
        const { error: updateError } = await supabase
            .from('users')
            .update({ is_verified: true })
            .eq('id', user.id);

        if (updateError) {
            throw new AppError('Failed to verify user', 500);
        }

        // Mark OTP as used
        await supabase
            .from('otps')
            .update({ is_used: true })
            .eq('id', otpRecord.id);

        // Get patient data
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id, full_name')
            .eq('user_id', user.id)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Generate Real Patient ID if it's currently PENDING or missing
        let patientId = patient.patient_id;
        if (!patientId || patientId.startsWith('PENDING-')) {
            patientId = await generatePatientId(user.id);

            // Update patient record with generated ID
            await supabase
                .from('patients')
                .update({ patient_id: patientId })
                .eq('user_id', user.id);

            await createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.PATIENT_ID_GENERATED,
                entityType: 'patient',
                entityId: patient.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { patientId },
                status: 'SUCCESS'
            });
        }

        // Generate tokens for immediate login
        const accessToken = generateAccessToken({
            userId: user.id,
            roleId: user.role_id,
            patientId: patient.id
        });

        const refreshToken = generateRefreshToken({
            userId: user.id
        });

        // Store refresh token
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await supabase
            .from('refresh_tokens')
            .insert({
                user_id: user.id,
                token: refreshToken,
                device_info: req.headers['user-agent'],
                ip_address: getClientIp(req),
                expires_at: refreshExpiresAt.toISOString()
            });

        // Set refresh token cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax', // Use lax in development for cross-port compatibility
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Audit log
        await createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.OTP_VERIFIED,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: { phone, purpose: 'REGISTRATION' },
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Account verified and logged in successfully',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    phone: user.phone,
                    email: user.email,
                    patientId: patientId,
                    fullName: patient.full_name
                }
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * PATIENT LOGIN
 * 1. Validate credentials
 * 2. Check if verified
 * 3. Generate Patient ID (if first login)
 * 4. Issue JWT tokens
 */
export async function login(req, res, next) {
    const { phone, email, password } = req.body;

    try {
        // Find user by phone or email
        let query = supabase
            .from('users')
            .select('id, phone, email, password_hash, role_id, is_verified, is_active');

        if (phone) {
            query = query.eq('phone', phone);
        } else if (email) {
            query = query.eq('email', email);
        }

        const { data: user, error: userError } = await query.single();

        if (userError) {
            if (userError.code === 'PGRST116') {
                // User not found - handle as 401
                await createAuditLog({
                    userId: null,
                    action: AUDIT_ACTIONS.USER_LOGIN,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: { phone, email, reason: 'User not found' },
                    status: 'FAILURE',
                    errorMessage: 'Invalid credentials'
                });
                throw new AppError('Invalid credentials', 401);
            }
            // Real database error (connection timeout, etc)
            console.error('Database connection error during login:', userError);
            throw new AppError(`Database connection error: ${userError.message}`, 500);
        }

        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        // Check if user is verified
        if (!user.is_verified) {
            throw new AppError('Account not verified. Please verify your OTP first.', 403);
        }

        // Check if user is active
        if (!user.is_active) {
            throw new AppError('Account is deactivated. Please contact support.', 403);
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.USER_LOGIN,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { phone, email, reason: 'Invalid password' },
                status: 'FAILURE',
                errorMessage: 'Invalid credentials'
            });

            throw new AppError('Invalid credentials', 401);
        }

        // Get patient data
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id, full_name')
            .eq('user_id', user.id)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Generate Patient ID if this is first login
        let patientId = patient.patient_id;
        if (!patientId) {
            patientId = await generatePatientId(user.id);

            // Update patient record with generated ID
            const { error: updateError } = await supabase
                .from('patients')
                .update({ patient_id: patientId })
                .eq('user_id', user.id);

            if (updateError) {
                console.error('Failed to update patient ID:', updateError);
            } else {
                await createAuditLog({
                    userId: user.id,
                    action: AUDIT_ACTIONS.PATIENT_ID_GENERATED,
                    entityType: 'patient',
                    entityId: patient.id,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    metadata: { patientId },
                    status: 'SUCCESS'
                });
            }
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            roleId: user.role_id,
            patientId: patient.id
        });

        const refreshToken = generateRefreshToken({
            userId: user.id
        });

        // Store refresh token in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const { error: tokenError } = await supabase
            .from('refresh_tokens')
            .insert({
                user_id: user.id,
                token: refreshToken,
                device_info: req.headers['user-agent'],
                ip_address: getClientIp(req),
                expires_at: expiresAt.toISOString()
            });

        if (tokenError) {
            console.error('Failed to store refresh token:', tokenError);
        }

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax', // Use lax in development for cross-port compatibility
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Audit log
        await createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: { phone, email, patientId },
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    phone: user.phone,
                    email: user.email,
                    patientId: patientId,
                    fullName: patient.full_name
                }
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * REFRESH TOKEN
 * Generate new access token using refresh token
 */
export async function refreshToken(req, res, next) {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    try {
        if (!refreshToken) {
            console.warn('Refresh attempt failed: No token provided in cookies or body');
            throw new AppError('Refresh token not provided', 401);
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

        // Check if token exists in database and is not revoked
        const { data: tokenRecord, error: tokenError } = await supabase
            .from('refresh_tokens')
            .select('*')
            .eq('token', refreshToken)
            .eq('user_id', decoded.userId)
            .eq('is_revoked', false)
            .gte('expires_at', new Date().toISOString())
            .single();

        if (tokenError || !tokenRecord) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        // Get user data + role name in one query
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, role_id, is_active, roles(name)')
            .eq('id', decoded.userId)
            .single();

        if (userError || !user || !user.is_active) {
            throw new AppError('User not found or inactive', 401);
        }

        const roleName = user.roles?.name || null;

        // Only look up patient record for PATIENT role (not SUPER_ADMIN / AMBULANCE)
        let patientId = null;
        if (roleName === 'PATIENT') {
            const { data: patient } = await supabase
                .from('patients')
                .select('id')
                .eq('user_id', user.id)
                .single();
            patientId = patient?.id || null;
        }

        // Build token payload — include role so verifyToken can read it directly
        const tokenPayload = {
            userId: user.id,
            roleId: user.role_id,
            role: roleName,
            ...(patientId ? { patientId } : {})
        };

        // Generate new access token
        const newAccessToken = generateAccessToken(tokenPayload);

        // Audit log
        await createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.TOKEN_REFRESH,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            next(new AppError('Invalid or expired refresh token', 401));
        } else {
            next(error);
        }
    }
}

/**
 * LOGOUT
 * Revoke refresh token
 */
export async function logout(req, res, next) {
    const { refreshToken } = req.cookies;
    const userId = req.user?.id;

    try {
        if (refreshToken) {
            // Revoke refresh token
            await supabase
                .from('refresh_tokens')
                .update({ is_revoked: true })
                .eq('token', refreshToken);
        }

        // Clear cookie
        res.clearCookie('refreshToken');

        // Audit log
        if (userId) {
            await createAuditLog({
                userId,
                action: AUDIT_ACTIONS.USER_LOGOUT,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                status: 'SUCCESS'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        next(error);
    }
}

/**
 * SUPER ADMIN LOGIN
 * 1. Validate credentials (username can be email or phone)
 * 2. Check for SUPER_ADMIN role (ID: 6)
 * 3. Issue JWT tokens
 */
export async function superAdminLogin(req, res, next) {
    const { username, password } = req.body;

    try {
        // Find user by username (email, phone, or username field)
        let query = supabase
            .from('users')
            .select('id, phone, email, password_hash, role_id, is_active');

        // Try to include username field, but catch if it doesn't exist
        let { data: user, error: userError } = await query
            .or(`email.eq.${username},phone.eq.${username},username.eq.${username}`)
            .single();

        if (userError) {
            // Handle case where 'username' column doesn't exist in the database yet
            if (userError.message?.includes('username') && (userError.message?.includes('does not exist') || userError.message?.includes('schema cache'))) {
                console.warn('⚠️ Username column missing, falling back to email/phone lookup.');
                const fallbackRes = await supabase
                    .from('users')
                    .select('id, phone, email, password_hash, role_id, is_active')
                    .or(`email.eq.${username},phone.eq.${username}`)
                    .single();
                user = fallbackRes.data;
                userError = fallbackRes.error;
            }

            if (userError) {
                if (userError.code === 'PGRST116') {
                    throw new AppError('Invalid admin credentials', 401);
                }
                console.error('Database connection error during super admin login:', userError);
                throw new AppError(`Database connection error: ${userError.message}`, 500);
            }
        }

        if (!user) {
            throw new AppError('Invalid admin credentials', 401);
        }

        // Check for SUPER_ADMIN role
        if (user.role_id !== 6) {
            throw new AppError('Access denied. Super Admin privileges required.', 403);
        }

        // Check if user is active
        if (!user.is_active) {
            throw new AppError('Account is deactivated.', 403);
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError('Invalid admin credentials', 401);
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            roleId: user.role_id,
            role: 'SUPER_ADMIN'
        });

        const refreshToken = generateRefreshToken({
            userId: user.id
        });

        // Store refresh token in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await supabase
            .from('refresh_tokens')
            .insert({
                user_id: user.id,
                token: refreshToken,
                device_info: req.headers['user-agent'],
                ip_address: getClientIp(req),
                expires_at: expiresAt.toISOString()
            });

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax', // Use lax in development for cross-port compatibility
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            message: 'Super Admin login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    username: user.username || user.email || user.phone,
                    role: 'SUPER_ADMIN'
                }
            }
        });

    } catch (error) {
        next(error);
    }
}


/**
 * RESEND OTP
 * Generate and send new OTP
 */
export async function resendOTP(req, res, next) {
    const { phone } = req.body;

    try {
        // Find user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, phone, is_verified')
            .eq('phone', phone)
            .single();

        if (userError || !user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_verified) {
            throw new AppError('User already verified', 400);
        }

        // Invalidate old OTPs
        await supabase
            .from('otps')
            .update({ is_used: true })
            .eq('user_id', user.id)
            .eq('purpose', 'REGISTRATION');

        // Generate new OTP
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store OTP
        const { error: otpError } = await supabase
            .from('otps')
            .insert({
                user_id: user.id,
                phone: user.phone,
                otp_code: otpCode,
                purpose: 'REGISTRATION',
                expires_at: expiresAt.toISOString()
            });

        if (otpError) {
            throw new AppError('Failed to generate OTP', 500);
        }

        // Send OTP via email
        if (user.email) {
            const { data: patient } = await supabase
                .from('patients')
                .select('full_name')
                .eq('user_id', user.id)
                .single();

            await sendOTPEmail(user.email, otpCode, patient?.full_name || 'User');

            await createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.OTP_SENT,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'],
                metadata: { purpose: 'RESEND', email: user.email },
                status: 'SUCCESS'
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            data: {
                otpExpiresAt: expiresAt
            }
        });

    } catch (error) {
        next(error);
    }
}
