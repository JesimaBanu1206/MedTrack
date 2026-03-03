import dotenv from 'dotenv';
dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,

    database: {
        url: process.env.DATABASE_URL,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_KEY
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '24h',  // 24h for MVP (was 15m which caused constant 401s)
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d' // 30d so users stay logged in
    },

    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },

    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    },

    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    }
};
