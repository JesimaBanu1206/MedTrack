# 🧪 MedTrack API Testing Guide

Complete API endpoint documentation with request/response examples.

---

## 📋 Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

---

## 🔐 Authentication Endpoints

### 1. Register Patient

**Endpoint:** `POST /auth/register`

**Description:** Register a new patient account. Sends OTP to email for verification.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "9876543210",
  "password": "SecurePass@123"
}
```

**Validation Rules:**
- `name`: Required, 2-255 characters
- `email`: Optional, valid email format
- `phone`: Required, 10-digit Indian mobile number (starts with 6-9)
- `password`: Required, min 8 chars, must contain uppercase, lowercase, number, and special character

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify OTP sent to your email.",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "otpExpiresAt": "2026-02-14T10:00:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
}
```

**Error Response (409):**
```json
{
  "success": false,
  "message": "User already exists and is verified. Please login."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "password": "SecurePass@123"
  }'
```

---

### 2. Verify OTP

**Endpoint:** `POST /auth/verify-otp`

**Description:** Verify the OTP sent during registration.

**Request:**
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Validation Rules:**
- `phone`: Required, 10-digit number
- `otp`: Required, exactly 6 digits

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully. You can now login.",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "verified": true
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "otp": "123456"
  }'
```

---

### 3. Login

**Endpoint:** `POST /auth/login`

**Description:** Login with verified credentials. Generates Patient ID on first login.

**Request:**
```json
{
  "phone": "9876543210",
  "password": "SecurePass@123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "9876543210",
      "email": "john.doe@example.com",
      "patientId": "PT-2026-0001",
      "name": "John Doe"
    }
  }
}
```

**Notes:**
- Sets `refreshToken` as HttpOnly cookie
- Patient ID is generated on first login only
- Patient ID format: `PT-YYYY-XXXX` (e.g., PT-2026-0001)
- Same Patient ID across all devices

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "message": "Account not verified. Please verify your OTP first."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "password": "SecurePass@123"
  }'
```

---

### 4. Refresh Token

**Endpoint:** `POST /auth/refresh-token`

**Description:** Get new access token using refresh token.

**Request:** No body required (uses cookie)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid or expired refresh token"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  --cookie "refreshToken=your-refresh-token"
```

---

### 5. Logout

**Endpoint:** `POST /auth/logout`

**Description:** Logout and revoke refresh token.

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 6. Resend OTP

**Endpoint:** `POST /auth/resend-otp`

**Description:** Resend OTP for unverified accounts.

**Request:**
```json
{
  "phone": "9876543210"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "otpExpiresAt": "2026-02-14T10:00:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210"
  }'
```

---

## 👤 Patient Endpoints

**All patient endpoints require authentication:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

### 7. Get Patient Dashboard

**Endpoint:** `GET /patient/dashboard`

**Description:** Get patient profile and recent medical records.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Patient dashboard data retrieved successfully",
  "data": {
    "patient": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "patientId": "PT-2026-0001",
      "fullName": "John Doe",
      "dob": "1990-01-15",
      "gender": "MALE",
      "bloodGroup": "O+",
      "address": "123 Main St, City",
      "emergencyContact": "9876543211",
      "guardianName": "Jane Doe",
      "guardianPhone": "9876543212",
      "profilePictureUrl": null,
      "createdAt": "2026-02-14T09:00:00.000Z"
    },
    "statistics": {
      "totalRecords": 5
    },
    "recentRecords": [
      {
        "id": "record-uuid",
        "fileName": "blood_test.pdf",
        "category": "LAB_REPORT",
        "createdAt": "2026-02-14T09:00:00.000Z"
      }
    ]
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:5000/api/patient/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 8. Update Patient Profile

**Endpoint:** `PUT /patient/profile`

**Description:** Update patient profile information.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Request:**
```json
{
  "fullName": "John Michael Doe",
  "dob": "1990-01-15",
  "gender": "MALE",
  "bloodGroup": "O+",
  "address": "123 Main Street, City, State - 123456",
  "emergencyContact": "9876543211",
  "guardianName": "Jane Doe",
  "guardianPhone": "9876543212"
}
```

**Validation Rules:**
- `gender`: MALE, FEMALE, or OTHER
- `bloodGroup`: A+, A-, B+, B-, AB+, AB-, O+, O-
- All fields are optional

**Success Response (200):**
```json
{
  "success": true,
  "message": "Patient profile updated successfully",
  "data": {
    "patient": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "fullName": "John Michael Doe",
      "dob": "1990-01-15",
      "gender": "MALE",
      "bloodGroup": "O+",
      "address": "123 Main Street, City, State - 123456",
      "emergencyContact": "9876543211",
      "guardianName": "Jane Doe",
      "guardianPhone": "9876543212"
    }
  }
}
```

**cURL Example:**
```bash
curl -X PUT http://localhost:5000/api/patient/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Michael Doe",
    "bloodGroup": "O+"
  }'
```

---

### 9. Get All Medical Records

**Endpoint:** `GET /patient/medical-records`

**Description:** Get all medical records with pagination.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 10)
- `category` (optional): Filter by category

**Categories:**
- GENERAL
- LAB_REPORT
- PRESCRIPTION
- IMAGING
- DISCHARGE_SUMMARY
- OTHER

**Success Response (200):**
```json
{
  "success": true,
  "message": "Medical records retrieved successfully",
  "data": {
    "records": [
      {
        "id": "record-uuid",
        "patientId": "patient-uuid",
        "fileUrl": "https://storage.url/file.pdf",
        "fileName": "blood_test_report.pdf",
        "fileType": "application/pdf",
        "fileSize": 245678,
        "mimeType": "application/pdf",
        "category": "LAB_REPORT",
        "description": "Annual blood test results",
        "uploadedBy": "user-uuid",
        "createdAt": "2026-02-14T09:00:00.000Z",
        "updatedAt": "2026-02-14T09:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

**cURL Example:**
```bash
# Get all records
curl -X GET http://localhost:5000/api/patient/medical-records \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get with pagination
curl -X GET "http://localhost:5000/api/patient/medical-records?page=2&limit=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by category
curl -X GET "http://localhost:5000/api/patient/medical-records?category=LAB_REPORT" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 10. Upload Medical Record

**Endpoint:** `POST /patient/medical-records/upload`

**Description:** Upload a medical record file (PDF, JPG, JPEG, PNG).

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data
```

**Request (Form Data):**
- `file`: File to upload (required)
- `category`: Category (optional, default: GENERAL)
- `description`: Description (optional)

**File Validation:**
- **Allowed types:** PDF, JPG, JPEG, PNG
- **Max size:** 10MB
- **Validation:** Magic number verification (not just MIME type)

**Success Response (201):**
```json
{
  "success": true,
  "message": "Medical record uploaded successfully",
  "data": {
    "record": {
      "id": "record-uuid",
      "patientId": "patient-uuid",
      "fileUrl": "https://storage.url/medical-records/PT-2026-0001/file.pdf",
      "fileName": "blood_test_report.pdf",
      "fileType": "application/pdf",
      "fileSize": 245678,
      "category": "LAB_REPORT",
      "description": "Annual blood test results",
      "createdAt": "2026-02-14T09:00:00.000Z"
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "File type mismatch. Declared: image/jpeg, Detected: application/pdf"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/patient/medical-records/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/blood_test.pdf" \
  -F "category=LAB_REPORT" \
  -F "description=Annual blood test results"
```

---

### 11. Get Medical Record by ID

**Endpoint:** `GET /patient/medical-records/:recordId`

**Description:** Get a specific medical record.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Medical record retrieved successfully",
  "data": {
    "record": {
      "id": "record-uuid",
      "patientId": "patient-uuid",
      "fileUrl": "https://storage.url/file.pdf",
      "fileName": "blood_test_report.pdf",
      "fileType": "application/pdf",
      "fileSize": 245678,
      "category": "LAB_REPORT",
      "description": "Annual blood test results",
      "createdAt": "2026-02-14T09:00:00.000Z"
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Medical record not found or access denied"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:5000/api/patient/medical-records/RECORD_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 12. Delete Medical Record

**Endpoint:** `DELETE /patient/medical-records/:recordId`

**Description:** Delete a medical record (file and metadata).

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Medical record deleted successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Medical record not found or access denied"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:5000/api/patient/medical-records/RECORD_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🔒 Security Features

### Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type | Window | Max Requests |
|--------------|--------|--------------|
| Auth (login, register) | 15 min | 5 |
| OTP | 10 min | 3 |
| Upload | 1 hour | 20 |
| General API | 15 min | 100 |

**Rate Limit Response (429):**
```json
{
  "success": false,
  "message": "Too many authentication attempts. Please try again after 15 minutes."
}
```

### Data Isolation

**CRITICAL:** All patient endpoints enforce strict data isolation:
- Patients can ONLY access their own data
- Backend filters by `user_id` and `patient_id`
- Supabase RLS policies provide additional layer
- Even if request is modified, access is denied

---

## 🧪 Testing Workflow

### Complete Registration to Dashboard Flow

```bash
# 1. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"9876543210","password":"Test@123"}'

# 2. Check email for OTP (or check console logs in development)

# 3. Verify OTP
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'

# 4. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"Test@123"}'

# Save the accessToken from response

# 5. Get Dashboard
curl -X GET http://localhost:5000/api/patient/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 6. Upload Medical Record
curl -X POST http://localhost:5000/api/patient/medical-records/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@test.pdf" \
  -F "category=GENERAL"
```

---

## 📊 Error Codes Reference

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

**Last Updated:** February 14, 2026
**API Version:** 1.0.0
