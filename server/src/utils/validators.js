export const validateEmail = (email) => {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

export const validatePhone = (phone) => {
    if (!phone) return false;
    const regex = /^[6-9]\d{9}$/;
    return regex.test(phone);
};

export const validatePassword = (password) => {
    if (!password) return false;
    return password.length >= 8;
};

export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
};

export const validatePatientId = (patientId) => {
    if (!patientId) return false;
    const regex = /^MED-\d{4}-\d{6}$/;
    return regex.test(patientId);
};

export const generatePatientId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `MED-${year}-${random}`;
};
