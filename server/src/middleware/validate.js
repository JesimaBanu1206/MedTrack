import Joi from 'joi';
import { AppError } from '../utils/errors.js';

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
export function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message)
                .join(', ');

            return next(new AppError(errorMessage, 400));
        }

        // Replace req.body with validated and sanitized value
        req.body = value;
        next();
    };
}

/**
 * Validation Schemas
 */

// Registration validation
export const registerSchema = Joi.object({
    fullName: Joi.string()
        .min(2)
        .max(255)
        .required()
        .trim()
        .messages({
            'string.empty': 'Full name is required',
            'string.min': 'Name must be at least 2 characters'
        }),

    email: Joi.string()
        .email()
        .max(255)
        .required()
        .trim()
        .lowercase()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required'
        }),

    phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.empty': 'Phone number is required',
            'string.pattern.base': 'Please provide a valid 10-digit phone number'
        }),

    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': 'Password must be at least 6 characters'
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .optional()
        .messages({
            'any.only': 'Passwords do not match'
        })
});

// OTP verification validation
export const verifyOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.empty': 'Phone number is required',
            'string.pattern.base': 'Please provide a valid 10-digit phone number'
        }),

    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.empty': 'OTP is required',
            'string.length': 'OTP must be 6 digits',
            'string.pattern.base': 'OTP must contain only numbers'
        })
});

// Login validation
export const loginSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .optional()
        .allow(null, '')
        .messages({
            'string.pattern.base': 'Please provide a valid 10-digit phone number'
        }),

    email: Joi.string()
        .email()
        .optional()
        .allow(null, '')
        .messages({
            'string.email': 'Please provide a valid email address'
        }),

    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required'
        })
}).or('phone', 'email');

// Resend OTP validation
export const resendOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .required()
        .messages({
            'string.empty': 'Phone number is required',
            'string.pattern.base': 'Please provide a valid 10-digit phone number'
        })
});

export const emergencyDriverRegisterSchema = Joi.object({
    driverName: Joi.string().min(2).max(255).required().trim(),
    licenseNumber: Joi.string().min(4).max(100).required().trim(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    email: Joi.string().email().max(255).required().trim().lowercase(),
    district: Joi.string().min(2).max(120).required().trim(),
    password: Joi.string().min(6).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).optional()
});

export const emergencyDriverVerifyOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
});

export const emergencyDriverLoginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

export const emergencyDriverLocationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracyMeters: Joi.number().min(0).optional().allow(null)
});

export const emergencyDriverStatusSchema = Joi.object({
    dutyStatus: Joi.string().valid('AVAILABLE', 'ON_DUTY', 'OFFLINE', 'ON_MISSION').required()
});

export const emergencyAlertStatusSchema = Joi.object({
    status: Joi.string().valid('ACCEPTED', 'REACHED_SPOT', 'LEFT_SPOT', 'REACHED_HOSPITAL', 'COMPLETED').required()
});

export const emergencyDriverSosNoteSchema = Joi.object({
    note: Joi.string().max(500).required().trim()
});

export const emergencyDriverResponseLogSchema = Joi.object({
    status: Joi.string().valid('COMPLETED', 'CANCELLED', 'NO_SHOW').optional().default('COMPLETED'),
    notes: Joi.string().max(500).optional().allow('', null).trim()
});

export const emergencyDriverApprovalSchema = Joi.object({
    approvalStatus: Joi.string().valid('APPROVED', 'REJECTED').required(),
    unitNumber: Joi.when('approvalStatus', {
        is: 'APPROVED',
        then: Joi.string().min(2).max(50).required(),
        otherwise: Joi.string().optional().allow('', null)
    }),
    rejectReason: Joi.when('approvalStatus', {
        is: 'REJECTED',
        then: Joi.string().max(500).required(),
        otherwise: Joi.string().optional().allow('', null)
    })
});

export const superAdminAccountUpdateSchema = Joi.object({
    email: Joi.string()
        .email()
        .max(255)
        .required()
        .trim()
        .lowercase(),
    currentPassword: Joi.string()
        .required(),
    newPassword: Joi.string()
        .min(6)
        .max(128)
        .required(),
    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'New password and confirm password must match'
        })
});

// Update patient profile validation
export const updatePatientSchema = Joi.object({
    fullName: Joi.string()
        .min(2)
        .max(255)
        .optional()
        .trim(),

    email: Joi.string()
        .email()
        .optional()
        .allow('', null)
        .trim()
        .lowercase(),

    dob: Joi.date()
        .max('now')
        .optional(),

    gender: Joi.string()
        .valid('MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other')
        .optional(),

    bloodGroup: Joi.string()
        .valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
        .optional(),

    address: Joi.string()
        .max(500)
        .optional()
        .trim(),

    guardianName: Joi.string()
        .max(255)
        .optional()
        .trim(),

    guardianPhone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .optional(),

    relation: Joi.string()
        .valid('Father', 'Mother', 'Spouse', 'Sibling', 'Guardian', 'Other')
        .optional(),

    pincode: Joi.string()
        .pattern(/^[0-9]{6}$/)
        .optional()
        .trim(),

    city: Joi.string()
        .max(100)
        .optional()
        .trim(),

    state: Joi.string()
        .max(100)
        .optional()
        .trim()
});

// Upload medical record validation
export const uploadRecordSchema = Joi.object({
    category: Joi.string()
        .valid('GENERAL', 'LAB_REPORT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'OTHER')
        .optional()
        .default('GENERAL'),

    description: Joi.string()
        .max(1000)
        .optional()
        .trim()
});
