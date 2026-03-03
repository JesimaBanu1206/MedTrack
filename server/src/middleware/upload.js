import multer from 'multer';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Multer configuration for file uploads
 * Uses memory storage for validation before uploading to Supabase
 */

// Memory storage - files stored in buffer for validation
const storage = multer.memoryStorage();

// File filter - preliminary check (will be validated again with magic numbers)
const fileFilter = (req, file, cb) => {
    const allowedMimes = config.upload.allowedTypes;

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(
            `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            400
        ), false);
    }
};

// Multer upload configuration
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.upload.maxFileSize, // Default 10MB
        files: 1 // Only one file at a time
    },
    fileFilter: fileFilter
});

/**
 * Error handler for multer errors
 */
export function handleMulterError(error, req, res, next) {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(
                `File too large. Maximum size: ${config.upload.maxFileSize / 1024 / 1024}MB`,
                400
            ));
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return next(new AppError('Too many files. Only one file allowed.', 400));
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError('Unexpected field name.', 400));
        }
        return next(new AppError(`Upload error: ${error.message}`, 400));
    }
    next(error);
}
