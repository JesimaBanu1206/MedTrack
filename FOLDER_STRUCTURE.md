# 📁 MedTrack Backend - Complete Folder Structure

```
MedTrack/
│
├── 📄 README_BACKEND.md              # Main project documentation
├── 📄 SETUP_GUIDE.md                 # Step-by-step setup instructions
├── 📄 API_DOCUMENTATION.md           # Complete API reference
├── 📄 QUICK_REFERENCE.md             # Quick commands & tips
├── 📄 IMPLEMENTATION_SUMMARY.md      # Delivery summary
├── 📄 docker-compose.yml             # Docker orchestration
│
├── 📂 database/
│   └── 📄 schema_with_rls.sql        # Complete DB schema with RLS policies
│
├── 📂 server/
│   ├── 📄 .env.example               # Environment variables template
│   ├── 📄 .dockerignore              # Docker ignore rules
│   ├── 📄 Dockerfile                 # Multi-stage Docker build
│   ├── 📄 package.json               # Node.js dependencies
│   │
│   └── 📂 src/
│       │
│       ├── 📄 server.js              # Express app entry point (4.3 KB)
│       │
│       ├── 📂 config/
│       │   ├── 📄 env.js             # Environment configuration
│       │   └── 📄 supabase.js        # Supabase client setup
│       │
│       ├── 📂 controllers/
│       │   ├── 📄 authController.js  # Authentication logic (19.6 KB)
│       │   │   ├── register()        # Patient registration
│       │   │   ├── verifyOTP()       # OTP verification
│       │   │   ├── login()           # Login with Patient ID generation
│       │   │   ├── refreshToken()    # Token refresh
│       │   │   ├── logout()          # Logout & token revocation
│       │   │   └── resendOTP()       # Resend OTP
│       │   │
│       │   └── 📄 patientController.js # Patient operations (15.8 KB)
│       │       ├── getPatientDashboard()    # Dashboard data
│       │       ├── updatePatientProfile()   # Update profile
│       │       ├── getMedicalRecords()      # Get all records
│       │       ├── getMedicalRecordById()   # Get single record
│       │       ├── uploadMedicalRecord()    # Upload file
│       │       └── deleteMedicalRecord()    # Delete record
│       │
│       ├── 📂 middleware/
│       │   ├── 📄 authMiddleware.js  # JWT verification (4.0 KB)
│       │   │   ├── authenticate()    # Verify JWT token
│       │   │   └── optionalAuthenticate() # Optional auth
│       │   │
│       │   ├── 📄 roleMiddleware.js  # Role-based access (2.5 KB)
│       │   │   ├── requireRole()     # Generic role check
│       │   │   ├── requirePatient    # Patient-only access
│       │   │   ├── requireDoctor     # Doctor-only access
│       │   │   ├── requireAdmin      # Admin-only access
│       │   │   └── requireStaff      # Staff-only access
│       │   │
│       │   ├── 📄 validate.js        # Input validation (5.1 KB)
│       │   │   ├── validate()        # Validation middleware factory
│       │   │   ├── registerSchema    # Registration validation
│       │   │   ├── verifyOTPSchema   # OTP validation
│       │   │   ├── loginSchema       # Login validation
│       │   │   ├── resendOTPSchema   # Resend OTP validation
│       │   │   ├── updatePatientSchema # Profile update validation
│       │   │   └── uploadRecordSchema  # File upload validation
│       │   │
│       │   ├── 📄 rateLimiter.js     # Rate limiting (3.0 KB)
│       │   │   ├── authLimiter       # Auth endpoints (5/15min)
│       │   │   ├── otpLimiter        # OTP endpoints (3/10min)
│       │   │   ├── apiLimiter        # General API (100/15min)
│       │   │   └── uploadLimiter     # Upload endpoints (20/hour)
│       │   │
│       │   ├── 📄 upload.js          # File upload config (1.8 KB)
│       │   │   ├── upload            # Multer configuration
│       │   │   └── handleMulterError # Multer error handler
│       │   │
│       │   └── 📄 errorHandler.js    # Error handling (2.1 KB)
│       │       ├── errorHandler()    # Global error handler
│       │       ├── notFoundHandler() # 404 handler
│       │       └── asyncHandler()    # Async wrapper
│       │
│       ├── 📂 routes/
│       │   ├── 📄 authRoutes.js      # Authentication routes (1.7 KB)
│       │   │   ├── POST /auth/register
│       │   │   ├── POST /auth/verify-otp
│       │   │   ├── POST /auth/login
│       │   │   ├── POST /auth/refresh-token
│       │   │   ├── POST /auth/logout
│       │   │   └── POST /auth/resend-otp
│       │   │
│       │   └── 📄 patientRoutes.js   # Patient routes (2.1 KB)
│       │       ├── GET  /patient/dashboard
│       │       ├── PUT  /patient/profile
│       │       ├── GET  /patient/medical-records
│       │       ├── GET  /patient/medical-records/:recordId
│       │       ├── POST /patient/medical-records/upload
│       │       └── DELETE /patient/medical-records/:recordId
│       │
│       └── 📂 utils/
│           ├── 📄 mailer.js          # Email service (4.8 KB)
│           │   └── sendOTPEmail()    # Send OTP email
│           │
│           ├── 📄 tokenUtils.js      # JWT utilities (846 B)
│           │   ├── generateAccessToken()  # Create access token
│           │   ├── generateRefreshToken() # Create refresh token
│           │   ├── verifyAccessToken()    # Verify access token
│           │   ├── verifyRefreshToken()   # Verify refresh token
│           │   └── decodeToken()          # Decode token
│           │
│           ├── 📄 otpUtils.js        # OTP utilities (370 B)
│           │   ├── generateOTP()     # Generate 6-digit OTP
│           │   ├── getOTPExpiry()    # Calculate expiry
│           │   └── isOTPExpired()    # Check if expired
│           │
│           ├── 📄 fileValidator.js   # File validation (4.0 KB)
│           │   ├── validateFileType()     # Magic number validation
│           │   ├── validateFileSize()     # Size validation
│           │   ├── sanitizeFilename()     # Filename sanitization
│           │   └── generateUniqueFilename() # Unique name generation
│           │
│           ├── 📄 patientIdGenerator.js # Patient ID logic (2.6 KB)
│           │   ├── generatePatientId()    # Generate PT-YYYY-XXXX
│           │   ├── patientIdExists()      # Check if exists
│           │   └── getPatientId()         # Get existing ID
│           │
│           ├── 📄 auditLogger.js     # Audit logging (2.9 KB)
│           │   ├── createAuditLog()  # Create log entry
│           │   ├── getClientIp()     # Extract IP address
│           │   └── AUDIT_ACTIONS     # Action constants
│           │
│           ├── 📄 errors.js          # Custom errors (791 B)
│           │   └── AppError          # Custom error class
│           │
│           └── 📄 validators.js      # Additional validators (934 B)
│               ├── isValidEmail()    # Email validation
│               ├── isValidPhone()    # Phone validation
│               └── isStrongPassword() # Password strength
│
└── 📂 client/
    └── (Frontend files - already exists)
```

---

## 📊 File Statistics

### Backend Source Code
- **Total Files:** 23
- **Total Size:** ~90 KB
- **Lines of Code:** ~2,500+

### Documentation
- **Total Files:** 5
- **Total Size:** ~150 KB
- **Pages:** ~50+

### Database
- **Schema File:** 1
- **Tables:** 7
- **RLS Policies:** 12+
- **Functions:** 3

### Docker
- **Dockerfile:** 1 (Multi-stage)
- **docker-compose.yml:** 1

---

## 🎯 Key Directories Explained

### `/server/src/config/`
Configuration files for environment variables and external services (Supabase).

### `/server/src/controllers/`
Business logic for authentication and patient operations. Contains all the core functionality.

### `/server/src/middleware/`
Request processing layers including authentication, validation, rate limiting, and error handling.

### `/server/src/routes/`
API endpoint definitions that connect URLs to controller functions.

### `/server/src/utils/`
Helper functions and utilities used across the application (email, tokens, validation, etc.).

### `/database/`
Database schema and migration files for Supabase PostgreSQL.

---

## 🔐 Security Layers

```
Request Flow:
│
├─ 1. Rate Limiter (rateLimiter.js)
│   └─ Prevents brute force attacks
│
├─ 2. Helmet (server.js)
│   └─ Security headers
│
├─ 3. CORS (server.js)
│   └─ Origin validation
│
├─ 4. Body Parser (server.js)
│   └─ Request parsing
│
├─ 5. Validation (validate.js)
│   └─ Input sanitization
│
├─ 6. Authentication (authMiddleware.js)
│   └─ JWT verification
│
├─ 7. Authorization (roleMiddleware.js)
│   └─ Role checking
│
├─ 8. Controller Logic
│   └─ Business operations
│
├─ 9. Database RLS
│   └─ Row-level security
│
└─ 10. Audit Logging (auditLogger.js)
    └─ Security trail
```

---

## 📝 File Naming Conventions

- **Controllers:** `*Controller.js` (e.g., authController.js)
- **Middleware:** `*Middleware.js` or descriptive (e.g., validate.js)
- **Routes:** `*Routes.js` (e.g., authRoutes.js)
- **Utils:** Descriptive names (e.g., mailer.js, tokenUtils.js)
- **Config:** Descriptive names (e.g., env.js, supabase.js)

---

## 🚀 Import Paths

All imports use ES6 modules:

```javascript
// Controllers
import { register, login } from '../controllers/authController.js';

// Middleware
import { authenticate } from '../middleware/authMiddleware.js';
import { validate, registerSchema } from '../middleware/validate.js';

// Utils
import { sendOTPEmail } from '../utils/mailer.js';
import { generatePatientId } from '../utils/patientIdGenerator.js';

// Config
import { config } from '../config/env.js';
import supabase from '../config/supabase.js';
```

---

## 📦 Dependencies

### Production
- express
- bcryptjs
- jsonwebtoken
- nodemailer
- @supabase/supabase-js
- helmet
- cors
- express-rate-limit
- cookie-parser
- joi
- multer
- file-type
- dotenv

### Development
- nodemon

---

## 🎨 Code Organization Principles

1. **Separation of Concerns:** Each file has a single responsibility
2. **Modularity:** Functions are small and reusable
3. **Security First:** Validation and sanitization everywhere
4. **Error Handling:** Comprehensive try-catch blocks
5. **Documentation:** Comments explain the "why", not the "what"
6. **Consistency:** Naming conventions followed throughout

---

**Last Updated:** February 14, 2026
**Version:** 1.0.0
