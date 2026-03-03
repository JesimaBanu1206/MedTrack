import crypto from 'crypto';

export const generateOTP = () => {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generatePatientId = (index) => {
    const year = new Date().getFullYear();
    // Assuming index is a number representing the count of patients
    // Format: PT-YYYY-XXXX (e.g. PT-2023-0001)
    const paddedIndex = String(index).padStart(4, '0');
    return `PT-${year}-${paddedIndex}`;
};

export const generateHash = (str) => {
    return crypto.createHash('sha256').update(str).digest('hex');
};
