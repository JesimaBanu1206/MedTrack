import './utils/dnsOptimizer.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
// Rate limiting removed for MVP — re-enable before production
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import labReportRoutes from './routes/labReportRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import emergencyPortalRoutes from './routes/emergencyPortalRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import hospitalAdminRoutes from './routes/hospitalAdminRoutes.js';
import aiDocumentRoutes from './routes/aiDocumentRoutes.js';
import passwordResetRoutes from './routes/passwordResetRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import nurseRoutes from './routes/nurseRoutes.js';
import receptionistRoutes from './routes/receptionistRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import districtRoutes from './routes/districtRoutes.js';

const app = express();

// =====================================================
// SECURITY MIDDLEWARE
// =====================================================

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS - Cross-Origin Resource Sharing
const allowedOrigins = config.clientUrl.split(',').map(o => o.trim());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes('*')) return callback(null, true);

        // Normalize origin for localhost/127.0.0.1 matching
        const normalizedOrigin = origin.replace('127.0.0.1', 'localhost');
        const normalizedAllowedArr = allowedOrigins.map(o => o.replace('127.0.0.1', 'localhost'));

        if (normalizedAllowedArr.indexOf(normalizedOrigin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// =====================================================
// BODY PARSING MIDDLEWARE
// =====================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// =====================================================
// REQUEST LOGGING (Development only)
// =====================================================
if (config.nodeEnv === 'development') {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
        });
        next();
    });
}

// =====================================================
// HEALTH CHECK ENDPOINT
// =====================================================
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'MedTrack API is running',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv
    });
});

// =====================================================
// API ROUTES
// =====================================================
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/patient/lab-reports', labReportRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/emergency-portal', emergencyPortalRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/super-admin/hospitals', hospitalRoutes);          // GH & PHC Centres
app.use('/api/hospital-admin', hospitalAdminRoutes);             // Hospital Admin panel
app.use('/api/ai', aiDocumentRoutes);                            // AI Document Analyzer
app.use('/api/auth', passwordResetRoutes);                       // Password reset (auth namespace)
app.use('/api/doctor', doctorRoutes);                            // Doctor + Staff portal
app.use('/api/nurse', nurseRoutes);                              // Nurse dashboard
app.use('/api/receptionist', receptionistRoutes);                // Receptionist portal ← NEW
app.use('/api/appointments', appointmentRoutes);                 // Public appointment booking ← NEW
app.use('/api/district', districtRoutes);                        // District Health Officer ← NEW

// =====================================================
// 404 HANDLER
// =====================================================
app.use(notFoundHandler);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================
app.use(errorHandler);

// =====================================================
// START SERVER
// =====================================================
const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🏥 MedTrack Healthcare Platform - Backend API');
    console.log('='.repeat(50));
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Server running on port: ${PORT}`);
    console.log(`Health check: http://127.0.0.1:${PORT}/health`);
    console.log(`Client URL: ${config.clientUrl}`);
    console.log('='.repeat(50));
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

// =====================================================
// UNHANDLED REJECTION HANDLER
// =====================================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
