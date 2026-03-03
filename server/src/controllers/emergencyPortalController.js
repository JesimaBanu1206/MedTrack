import bcrypt from 'bcryptjs';
import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { generateOTP } from '../utils/otpUtils.js';
import { sendOTPEmail } from '../utils/mailer.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokenUtils.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';
import { config } from '../config/env.js';
import { validateFileType, validateFileSize, generateUniqueFilename } from '../utils/fileValidator.js';


const OTP_PURPOSE = 'EMERGENCY_DRIVER_REGISTRATION';

export async function emergencyDriverRegister(req, res, next) {
    const { driverName, licenseNumber, phone, email, district, password } = req.body;

    try {
        const { data: existingDriverByLicense } = await supabase
            .from('emergency_drivers')
            .select('id')
            .eq('license_number', licenseNumber)
            .maybeSingle();

        if (existingDriverByLicense) {
            throw new AppError('License number is already registered', 409);
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id, is_verified')
            .or(`phone.eq.${phone},email.eq.${email}`)
            .maybeSingle();

        if (existingUser?.is_verified) {
            throw new AppError('User already exists. Please login.', 409);
        }

        if (existingUser) {
            await supabase.from('users').delete().eq('id', existingUser.id);
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'AMBULANCE')
            .single();

        if (roleError || !role) {
            throw new AppError('AMBULANCE role not found', 500);
        }

        const { data: newUser, error: createUserError } = await supabase
            .from('users')
            .insert({
                email,
                phone,
                password_hash: passwordHash,
                role_id: role.id,
                is_verified: false,
                is_active: false
            })
            .select('id, email, phone')
            .single();

        if (createUserError || !newUser) {
            throw new AppError('Failed to create emergency account', 500);
        }

        // --- Handle IMAGE UPLOADS ---
        let licenseImageUrl = null;
        let profileImageUrl = null;

        const files = req.files || {};
        const licenseFile = files.licenseImage ? files.licenseImage[0] : null;
        const profileFile = files.profileImage ? files.profileImage[0] : null;

        // Process License Image
        if (licenseFile) {
            const sizeValidation = validateFileSize(licenseFile.size, config.upload?.maxFileSize);
            if (!sizeValidation.valid) throw new AppError(`License Image: ${sizeValidation.error}`, 400);

            const typeValidation = await validateFileType(licenseFile.buffer, licenseFile.mimetype);
            if (!typeValidation.valid) throw new AppError(`License Image: ${typeValidation.error}`, 400);

            const fileName = generateUniqueFilename(licenseFile.originalname, newUser.id);
            const filePath = `driver-docs/${newUser.id}/license_${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('medical-records')
                .upload(filePath, licenseFile.buffer, { contentType: typeValidation.detectedType });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('medical-records').getPublicUrl(filePath);
                licenseImageUrl = urlData.publicUrl;
            }
        }

        // Process Profile Image
        if (profileFile) {
            const sizeValidation = validateFileSize(profileFile.size, config.upload?.maxFileSize);
            if (!sizeValidation.valid) throw new AppError(`Profile Image: ${sizeValidation.error}`, 400);

            const typeValidation = await validateFileType(profileFile.buffer, profileFile.mimetype);
            if (!typeValidation.valid) throw new AppError(`Profile Image: ${typeValidation.error}`, 400);

            const fileName = generateUniqueFilename(profileFile.originalname, newUser.id);
            const filePath = `driver-docs/${newUser.id}/profile_${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('medical-records')
                .upload(filePath, profileFile.buffer, { contentType: typeValidation.detectedType });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('medical-records').getPublicUrl(filePath);
                profileImageUrl = urlData.publicUrl;
            }
        }

        const { error: driverError } = await supabase
            .from('emergency_drivers')
            .insert({
                user_id: newUser.id,
                driver_name: driverName,
                license_number: licenseNumber,
                district,
                license_image_url: licenseImageUrl,
                profile_image_url: profileImageUrl
            });


        if (driverError) {
            console.error('Emergency driver profile creation error:', driverError);
            await supabase.from('users').delete().eq('id', newUser.id);
            throw new AppError('Failed to create emergency driver profile', 500);
        }

        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const { error: otpError } = await supabase.from('otps').insert({
            user_id: newUser.id,
            phone,
            otp_code: otpCode,
            purpose: OTP_PURPOSE,
            expires_at: expiresAt.toISOString()
        });

        if (otpError) {
            throw new AppError('Failed to generate OTP', 500);
        }

        let otpDeliveryStatus = 'SENT';
        try {
            await sendOTPEmail(email, otpCode, driverName);
        } catch (emailError) {
            otpDeliveryStatus = 'EMAIL_FAILED';
            console.error('Emergency OTP email sending failed:', emailError?.message || emailError);
        }

        await createAuditLog({
            userId: newUser.id,
            action: AUDIT_ACTIONS.USER_REGISTER,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: { module: 'EMERGENCY_PORTAL', district, licenseNumber },
            status: 'SUCCESS'
        });

        res.status(201).json({
            success: true,
            message: otpDeliveryStatus === 'SENT'
                ? 'Registration successful. Verify OTP to continue.'
                : 'Registration successful, but OTP email delivery failed. Please contact support or retry.',
            data: {
                userId: newUser.id,
                phone,
                email,
                otpExpiresAt: expiresAt,
                otpDeliveryStatus
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function emergencyDriverVerifyOtp(req, res, next) {
    const { phone, otp } = req.body;

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, phone, is_verified')
            .eq('phone', phone)
            .single();

        if (userError || !user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_verified) {
            throw new AppError('Account already verified. Please login.', 400);
        }

        const { data: otpRecord, error: otpError } = await supabase
            .from('otps')
            .select('id')
            .eq('user_id', user.id)
            .eq('otp_code', otp)
            .eq('purpose', OTP_PURPOSE)
            .eq('is_used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) {
            throw new AppError('Invalid or expired OTP', 400);
        }

        await supabase.from('users').update({ is_verified: true }).eq('id', user.id);
        await supabase.from('otps').update({ is_used: true }).eq('id', otpRecord.id);

        res.status(200).json({
            success: true,
            message: 'OTP verified. Wait for Super Admin approval to login.'
        });
    } catch (error) {
        next(error);
    }
}

export async function emergencyDriverLogin(req, res, next) {
    const { username, password } = req.body;

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, phone, email, password_hash, role_id, is_verified, is_active')
            .or(`email.eq.${username},phone.eq.${username}`)
            .single();

        if (userError || !user) {
            throw new AppError('Invalid credentials', 401);
        }

        const { data: role } = await supabase
            .from('roles')
            .select('name')
            .eq('id', user.role_id)
            .single();

        if (role?.name !== 'AMBULANCE') {
            throw new AppError('Emergency portal access only for drivers', 403);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError('Invalid credentials', 401);
        }

        if (!user.is_verified) {
            throw new AppError('Verify OTP before login.', 403);
        }

        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id, approval_status, unit_number, driver_name, district, duty_status')
            .eq('user_id', user.id)
            .single();

        if (driverError || !driver) {
            throw new AppError('Driver profile not found', 404);
        }

        if (driver.approval_status !== 'APPROVED' || !user.is_active) {
            throw new AppError('Super Admin approval pending. Login blocked.', 403);
        }

        const accessToken = generateAccessToken({
            userId: user.id,
            roleId: user.role_id,
            role: 'AMBULANCE',
            emergencyDriverId: driver.id
        });

        const refreshToken = generateRefreshToken({ userId: user.id });
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await supabase.from('refresh_tokens').insert({
            user_id: user.id,
            token: refreshToken,
            device_info: req.headers['user-agent'],
            ip_address: getClientIp(req),
            expires_at: refreshExpiresAt.toISOString()
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            message: 'Emergency portal login successful',
            data: {
                accessToken,
                user: {
                    id: user.id,
                    role: 'AMBULANCE',
                    username: user.email || user.phone,
                    driverId: driver.id,
                    driverName: driver.driver_name,
                    district: driver.district,
                    unitNumber: driver.unit_number,
                    dutyStatus: driver.duty_status
                }
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getEmergencyDriverProfile(req, res, next) {
    try {
        const { data: driver, error } = await supabase
            .from('emergency_drivers')
            .select('id, driver_name, license_number, district, approval_status, unit_number, duty_status, sos_note, last_location_at, created_at')
            .eq('user_id', req.user.id)
            .single();

        if (error || !driver) {
            throw new AppError('Driver profile not found', 404);
        }

        res.status(200).json({
            success: true,
            data: driver
        });
    } catch (error) {
        next(error);
    }
}

export async function updateEmergencyDriverLocation(req, res, next) {
    const { latitude, longitude, accuracyMeters } = req.body;

    try {
        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id')
            .eq('user_id', req.user.id)
            .single();

        if (driverError || !driver) {
            throw new AppError('Driver profile not found', 404);
        }

        const nowIso = new Date().toISOString();

        const { error: locationError } = await supabase
            .from('emergency_driver_locations')
            .insert({
                driver_id: driver.id,
                latitude,
                longitude,
                accuracy_meters: accuracyMeters || null,
                source: 'GPS',
                recorded_at: nowIso
            });

        if (locationError) {
            throw new AppError('Failed to store live location', 500);
        }

        await supabase
            .from('emergency_drivers')
            .update({
                last_location_at: nowIso
            })
            .eq('id', driver.id);

        res.status(200).json({
            success: true,
            message: 'Live location updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

export async function updateEmergencyDriverDutyStatus(req, res, next) {
    const { dutyStatus } = req.body;

    try {
        const { error } = await supabase
            .from('emergency_drivers')
            .update({
                duty_status: dutyStatus,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', req.user.id);

        if (error) {
            throw new AppError('Failed to update duty status', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Duty status updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

export async function updateEmergencyDriverSosNote(req, res, next) {
    const { note } = req.body;

    try {
        const { error } = await supabase
            .from('emergency_drivers')
            .update({
                sos_note: note,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', req.user.id);

        if (error) {
            throw new AppError('Failed to submit SOS note', 500);
        }

        res.status(200).json({
            success: true,
            message: 'SOS note submitted to dispatch'
        });
    } catch (error) {
        next(error);
    }
}

export async function getEmergencyDriverLocationHistory(req, res, next) {
    const limit = Number(req.query.limit || 20);

    try {
        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id')
            .eq('user_id', req.user.id)
            .single();

        if (driverError || !driver) {
            throw new AppError('Driver profile not found', 404);
        }

        const { data, error } = await supabase
            .from('emergency_driver_locations')
            .select('latitude, longitude, accuracy_meters, source, recorded_at')
            .eq('driver_id', driver.id)
            .order('recorded_at', { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 100));

        if (error) {
            throw new AppError('Failed to fetch location history', 500);
        }

        res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        next(error);
    }
}

export async function logEmergencyDriverResponse(req, res, next) {
    const { status = 'COMPLETED', notes } = req.body;

    try {
        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id, approval_status')
            .eq('user_id', req.user.id)
            .single();

        if (driverError || !driver) {
            throw new AppError('Driver profile not found', 404);
        }

        if (driver.approval_status !== 'APPROVED') {
            throw new AppError('Driver access is not approved', 403);
        }

        const { error } = await supabase
            .from('emergency_driver_response_logs')
            .insert({
                driver_id: driver.id,
                status,
                notes: notes || null,
                responded_at: new Date().toISOString()
            });

        if (error) {
            throw new AppError('Failed to log response', 500);
        }

        res.status(201).json({
            success: true,
            message: 'Response logged successfully'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get active emergency alerts for the driver (based on unit number)
 * @route   GET /api/emergency-portal/alerts/active
 */
export async function getActiveAlerts(req, res, next) {
    try {
        const { data: driver } = await supabase
            .from('emergency_drivers')
            .select('unit_number, approval_status')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!driver || !driver.unit_number) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Find alerts that are:
        // 1. Specifically assigned to this unit (any non-terminal status)
        // 2. OR are PENDING (unassigned) and available for any active driver
        const { data: alerts, error } = await supabase
            .from('emergency_alerts')
            .select('*')
            .or(`assigned_unit_no.eq.${driver.unit_number},and(status.eq.PENDING,assigned_unit_no.is.null)`)
            .not('status', 'in', '("COMPLETED","REJECTED")')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({ success: true, data: alerts || [] });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Update status of an emergency alert
 * @route   PATCH /api/emergency-portal/alerts/:alertId/status
 *
 * Valid transitions:
 *   PENDING  → DISPATCHED  (when driver sends 'ACCEPTED')
 *   DISPATCHED → REACHED_SPOT → LEFT_SPOT → REACHED_HOSPITAL → COMPLETED
 */
export async function updateAlertStatus(req, res, next) {
    const { alertId } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['ACCEPTED', 'REACHED_SPOT', 'LEFT_SPOT', 'REACHED_HOSPITAL', 'COMPLETED'];
    if (!VALID_STATUSES.includes(status)) {
        return next(new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400));
    }

    try {
        // Fetch driver profile
        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id, unit_number, driver_name, district, phone')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (driverError || !driver) throw new AppError('Driver not found', 404);

        // Fetch the alert (use maybeSingle to avoid PGRST116 throwing a 404 via errorHandler)
        const { data: alert, error: fetchError } = await supabase
            .from('emergency_alerts')
            .select('id, status, assigned_unit_no')
            .eq('id', alertId)
            .maybeSingle();

        if (fetchError) {
            console.error('Alert fetch error:', fetchError);
            throw new AppError('Failed to fetch alert: ' + fetchError.message, 500);
        }
        if (!alert) throw new AppError(`Alert ${alertId} not found in database`, 404);

        // Prevent stealing another driver's accepted alert
        if (
            alert.assigned_unit_no &&
            alert.assigned_unit_no !== driver.unit_number &&
            alert.status !== 'PENDING'
        ) {
            throw new AppError('This alert is already assigned to another unit', 403);
        }

        let updateData = {
            updated_at: new Date().toISOString()
        };

        if (status === 'ACCEPTED') {
            // Driver accepts a PENDING alert → set status to DISPATCHED and assign unit
            if (alert.status !== 'PENDING') {
                throw new AppError('Only PENDING alerts can be accepted', 400);
            }
            updateData.status = 'DISPATCHED';
            updateData.assigned_unit_no = driver.unit_number;
            updateData.unit_details = {
                ambulance_type: 'Advanced Life Support (ALS)',
                driver_name: driver.driver_name,
                contact: driver.phone || 'N/A',
                district: driver.district,
                unit_number: driver.unit_number
            };
        } else {
            // All subsequent stages: REACHED_SPOT, LEFT_SPOT, REACHED_HOSPITAL, COMPLETED
            // Only the assigned driver can update
            if (alert.assigned_unit_no !== driver.unit_number) {
                throw new AppError('You are not assigned to this alert', 403);
            }
            updateData.status = status;
        }

        const { error: updateError } = await supabase
            .from('emergency_alerts')
            .update(updateData)
            .eq('id', alertId);

        if (updateError) throw updateError;

        // Sync driver duty_status
        if (updateData.status === 'DISPATCHED') {
            // Driver just accepted → set ON_MISSION
            await supabase
                .from('emergency_drivers')
                .update({ duty_status: 'ON_MISSION' })
                .eq('id', driver.id);
        } else if (status === 'COMPLETED') {
            // Mission done → set AVAILABLE and log the completed mission
            await supabase
                .from('emergency_drivers')
                .update({ duty_status: 'AVAILABLE' })
                .eq('id', driver.id);

            await supabase
                .from('emergency_driver_response_logs')
                .insert({
                    driver_id: driver.id,
                    status: 'COMPLETED',
                    notes: `Mission ${alertId} completed`,
                    responded_at: new Date().toISOString()
                });
        }

        res.status(200).json({
            success: true,
            message: `Mission status updated to ${updateData.status}`,
            data: { alertId, newStatus: updateData.status }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Get ongoing and completed missions for the driver
 * @route   GET /api/emergency-portal/missions
 */
export async function getMissions(req, res, next) {
    try {
        const { data: driver, error: driverError } = await supabase
            .from('emergency_drivers')
            .select('id, unit_number')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (driverError || !driver) throw new AppError('Driver not found', 404);

        const { data: alerts, error } = await supabase
            .from('emergency_alerts')
            .select('id, status, latitude, longitude, image_url, created_at, updated_at')
            .eq('assigned_unit_no', driver.unit_number)
            .not('status', 'eq', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const allAlerts = alerts || [];
        const ongoing = allAlerts.filter(a => !['COMPLETED', 'REJECTED'].includes(a.status));
        const completed = allAlerts.filter(a => a.status === 'COMPLETED');

        // Lives saved = total completed missions for this driver
        const livesSaved = completed.length;

        res.status(200).json({
            success: true,
            data: { ongoing, completed, pending: [], livesSaved }
        });
    } catch (error) {
        next(error);
    }
}

