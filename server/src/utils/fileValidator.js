import { fileTypeFromBuffer } from 'file-type';

/**
 * File validation using magic numbers (not just MIME types)
 * This prevents file type spoofing attacks
 */

const ALLOWED_TYPES = {
    'application/pdf': {
        ext: 'pdf',
        magic: [0x25, 0x50, 0x44, 0x46] // %PDF
    },
    'image/jpeg': {
        ext: 'jpg',
        magic: [0xFF, 0xD8, 0xFF]
    },
    'image/jpg': {
        ext: 'jpg',
        magic: [0xFF, 0xD8, 0xFF]
    },
    'image/png': {
        ext: 'png',
        magic: [0x89, 0x50, 0x4E, 0x47]
    }
};

/**
 * Validate file type using magic number
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - Declared MIME type
 * @returns {Promise<{valid: boolean, detectedType: string, error?: string}>}
 */
export async function validateFileType(buffer, mimetype) {
    try {
        // Use file-type library to detect actual file type from magic numbers
        const detectedType = await fileTypeFromBuffer(buffer);

        if (!detectedType) {
            return {
                valid: false,
                detectedType: null,
                error: 'Unable to detect file type'
            };
        }

        // Check if detected type matches allowed types
        const allowedMimes = Object.keys(ALLOWED_TYPES);
        const detectedMime = detectedType.mime;

        if (!allowedMimes.includes(detectedMime)) {
            return {
                valid: false,
                detectedType: detectedMime,
                error: `File type ${detectedMime} is not allowed. Allowed types: PDF, JPG, JPEG, PNG`
            };
        }

        // Additional security: Check if declared MIME matches detected MIME
        // Allow some flexibility for JPEG variants
        const isJpegVariant = (mime) => mime === 'image/jpeg' || mime === 'image/jpg';

        if (!(mimetype === detectedMime ||
            (isJpegVariant(mimetype) && isJpegVariant(detectedMime)))) {
            return {
                valid: false,
                detectedType: detectedMime,
                error: `File type mismatch. Declared: ${mimetype}, Detected: ${detectedMime}`
            };
        }

        return {
            valid: true,
            detectedType: detectedMime
        };
    } catch (error) {
        return {
            valid: false,
            detectedType: null,
            error: `File validation error: ${error.message}`
        };
    }
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFileSize(size, maxSize = 10 * 1024 * 1024) { // Default 10MB
    if (size > maxSize) {
        return {
            valid: false,
            error: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size ${(maxSize / 1024 / 1024).toFixed(2)}MB`
        };
    }

    return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
    // Remove path separators and special characters
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.+/g, '.')
        .substring(0, 255); // Limit filename length
}

/**
 * Generate unique filename with timestamp
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID
 * @returns {string} - Unique filename
 */
export function generateUniqueFilename(originalName, userId) {
    const timestamp = Date.now();
    const sanitized = sanitizeFilename(originalName);
    const extension = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));

    return `${userId}_${timestamp}_${nameWithoutExt}.${extension}`;
}
