# 🚀 MedTrack Backend - Deployment & Testing Guide

## 📋 Pre-Deployment Checklist

### ✅ Before You Start

- [ ] Node.js 18+ installed
- [ ] npm 9+ installed
- [ ] Supabase account created
- [ ] Gmail app password ready (provided: livcnogunkyepynw)
- [ ] Code editor (VS Code recommended)

---

## 🗄️ STEP 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name:** MedTrack
   - **Database Password:** (Save this securely!)
   - **Region:** Choose closest to you
4. Wait for project to initialize (~2 minutes)

### 1.2 Get Credentials

Once project is ready:

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key** (NOT the anon key!)

3. Go to **Project Settings** → **Database**
4. Copy **Connection String** (URI format)

### 1.3 Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Open file: `MedTrack/database/schema_with_rls.sql`
4. Copy ALL contents and paste into SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Wait for success message (~10 seconds)

**Verify Tables Created:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see: `audit_logs`, `medical_records`, `otps`, `patients`, `refresh_tokens`, `roles`, `users`

### 1.4 Create Storage Bucket

1. Go to **Storage** in Supabase
2. Click **"Create a new bucket"**
3. Settings:
   - **Name:** `medical-records` (exact name, lowercase)
   - **Public:** OFF (keep private)
   - **File size limit:** 10 MB
4. Click **"Create bucket"**

### 1.5 Configure Storage Policies

In SQL Editor, run:

```sql
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload medical records"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medical-records');

-- Allow users to read their own files
CREATE POLICY "Users can read medical records"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'medical-records');

-- Allow users to delete their own files
CREATE POLICY "Users can delete medical records"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'medical-records');
```

---

## ⚙️ STEP 2: Backend Configuration

### 2.1 Install Dependencies

```bash
cd c:\Users\Windows\Desktop\Health\MT\MedTrack\server
npm install
```

**Expected output:**
```
added 150+ packages in 30s
```

### 2.2 Create Environment File

```bash
# Copy example file
copy .env.example .env
```

### 2.3 Configure .env File

Open `server/.env` and fill in:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Supabase (Replace with YOUR values from Step 1.2)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR-SERVICE-ROLE-KEY-HERE
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT.supabase.co:5432/postgres

# JWT Secrets (Generate new ones - see below)
JWT_ACCESS_SECRET=your-generated-access-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here

# Email (Already configured for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sih1620hs@gmail.com
SMTP_PASS=livcnogunkyepynw

# Client URL
CLIENT_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,image/jpeg,image/jpg,image/png
```

### 2.4 Generate JWT Secrets

Run these commands in terminal:

```bash
# Generate Access Secret
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate Refresh Secret
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste into your `.env` file.

---

## 🚀 STEP 3: Start the Server

### 3.1 Development Mode

```bash
cd server
npm run dev
```

**Expected output:**
```
==================================================
🏥 MedTrack Healthcare Platform - Backend API
==================================================
Environment: development
Server running on port: 5000
Health check: http://localhost:5000/health
Client URL: http://localhost:5173
==================================================
```

### 3.2 Verify Server is Running

Open new terminal and run:

```bash
curl http://localhost:5000/health
```

**Expected response:**
```json
{
  "success": true,
  "message": "MedTrack API is running",
  "timestamp": "2026-02-14T09:55:33.000Z",
  "environment": "development"
}
```

---

## 🧪 STEP 4: Test the API

### Test 1: Register a Patient

```bash
curl -X POST http://localhost:5000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Test Patient\",\"email\":\"test@example.com\",\"phone\":\"9876543210\",\"password\":\"Test@123\"}"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Registration successful. Please verify OTP sent to your email.",
  "data": {
    "userId": "uuid-here",
    "email": "test@example.com",
    "phone": "9876543210",
    "otpExpiresAt": "2026-02-14T10:05:33.000Z"
  }
}
```

**Check Console:** You should see OTP in server logs:
```
✅ OTP email sent successfully to test@example.com
```

### Test 2: Verify OTP

**Note:** Use the OTP from console logs (in development, check terminal output)

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\",\"otp\":\"123456\"}"
```

**Expected response:**
```json
{
  "success": true,
  "message": "OTP verified successfully. You can now login.",
  "data": {
    "userId": "uuid-here",
    "verified": true
  }
}
```

### Test 3: Login

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\",\"password\":\"Test@123\"}"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "phone": "9876543210",
      "email": "test@example.com",
      "patientId": "PT-2026-0001",
      "name": "Test Patient"
    }
  }
}
```

**Important:** Save the `accessToken` for next tests!

### Test 4: Get Dashboard

```bash
curl -X GET http://localhost:5000/api/patient/dashboard ^
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Patient dashboard data retrieved successfully",
  "data": {
    "patient": {
      "id": "uuid-here",
      "patientId": "PT-2026-0001",
      "fullName": "Test Patient",
      "dob": null,
      "gender": null,
      "bloodGroup": null,
      ...
    },
    "statistics": {
      "totalRecords": 0
    },
    "recentRecords": []
  }
}
```

### Test 5: Upload Medical Record

Create a test PDF file or use any PDF, then:

```bash
curl -X POST http://localhost:5000/api/patient/medical-records/upload ^
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" ^
  -F "file=@C:\path\to\test.pdf" ^
  -F "category=LAB_REPORT" ^
  -F "description=Test upload"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Medical record uploaded successfully",
  "data": {
    "record": {
      "id": "uuid-here",
      "fileName": "test.pdf",
      "fileType": "application/pdf",
      "category": "LAB_REPORT",
      ...
    }
  }
}
```

---

## 🐳 STEP 5: Docker Deployment (Optional)

### 5.1 Create Root .env File

Create `.env` in root directory (same level as docker-compose.yml):

```bash
cd c:\Users\Windows\Desktop\Health\MT\MedTrack
copy server\.env .env
```

### 5.2 Build and Run

```bash
docker-compose up --build
```

### 5.3 Run in Background

```bash
docker-compose up -d
```

### 5.4 View Logs

```bash
docker-compose logs -f backend
```

### 5.5 Stop Services

```bash
docker-compose down
```

---

## 🔍 STEP 6: Verify Data Isolation

### Test Patient Data Isolation

1. **Register Patient 1:**
   ```bash
   # Register with phone: 9876543210
   # Login and save token as TOKEN_1
   ```

2. **Register Patient 2:**
   ```bash
   # Register with phone: 9876543211
   # Login and save token as TOKEN_2
   ```

3. **Upload record for Patient 1:**
   ```bash
   curl -X POST http://localhost:5000/api/patient/medical-records/upload ^
     -H "Authorization: Bearer TOKEN_1" ^
     -F "file=@test1.pdf"
   ```

4. **Try to access Patient 1's data with Patient 2's token:**
   ```bash
   curl -X GET http://localhost:5000/api/patient/dashboard ^
     -H "Authorization: Bearer TOKEN_2"
   ```

   **Expected:** Patient 2 should ONLY see their own data, NOT Patient 1's data.

---

## 📊 STEP 7: Verify Database

### Check Tables in Supabase

Go to **Table Editor** in Supabase and verify:

1. **roles table:** Should have 7 roles
2. **users table:** Should have your test users
3. **patients table:** Should have patient records with Patient IDs
4. **otps table:** Should have OTP records (used ones marked)
5. **refresh_tokens table:** Should have active tokens
6. **medical_records table:** Should have uploaded files
7. **audit_logs table:** Should have all actions logged

### Verify RLS Policies

In SQL Editor:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`

---

## 🛡️ STEP 8: Security Verification

### Test Rate Limiting

Try registering 6 times in 15 minutes:

```bash
# After 5 attempts, you should get:
{
  "success": false,
  "message": "Too many authentication attempts. Please try again after 15 minutes."
}
```

### Test Invalid Token

```bash
curl -X GET http://localhost:5000/api/patient/dashboard ^
  -H "Authorization: Bearer invalid-token"
```

**Expected:**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Test File Validation

Try uploading a .exe file renamed to .pdf:

**Expected:**
```json
{
  "success": false,
  "message": "File type mismatch. Declared: application/pdf, Detected: application/x-msdownload"
}
```

---

## 📈 STEP 9: Monitor & Debug

### View Server Logs

Development mode shows all logs in console:
- OTP codes
- Database queries
- Errors
- Audit events

### Check Audit Logs

In Supabase SQL Editor:

```sql
-- View recent audit logs
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- View failed login attempts
SELECT * FROM audit_logs 
WHERE action = 'USER_LOGIN' AND status = 'FAILURE'
ORDER BY created_at DESC;

-- View OTP activities
SELECT * FROM audit_logs 
WHERE action LIKE '%OTP%'
ORDER BY created_at DESC;
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Missing Supabase URL or Key"

**Solution:**
```bash
# Verify .env file exists
dir server\.env

# Check if variables are loaded
node -e "require('dotenv').config({path:'./server/.env'}); console.log(process.env.SUPABASE_URL)"
```

### Issue 2: "Failed to connect to database"

**Solution:**
- Verify Supabase project is active
- Check DATABASE_URL is correct
- Ensure you're using SERVICE_ROLE_KEY (not anon key)
- Check internet connection

### Issue 3: "OTP not received in email"

**Solution:**
- Check spam folder
- Verify SMTP credentials
- In development, check console logs for OTP
- Verify email address is correct

### Issue 4: "File upload fails"

**Solution:**
- Verify bucket name is exactly `medical-records`
- Check bucket is private
- Verify storage policies are applied
- Check file size < 10MB

### Issue 5: "CORS error"

**Solution:**
```env
# Update CLIENT_URL in .env
CLIENT_URL=http://localhost:5173
```

Restart server after changing .env

---

## ✅ Production Deployment Checklist

Before deploying to production:

- [ ] Change `NODE_ENV=production` in .env
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Update `CLIENT_URL` to production domain
- [ ] Enable HTTPS
- [ ] Use production Supabase project
- [ ] Set up monitoring (PM2, New Relic)
- [ ] Configure error tracking (Sentry)
- [ ] Set up database backups
- [ ] Review and adjust rate limits
- [ ] Test all endpoints in production
- [ ] Set up CI/CD pipeline
- [ ] Configure logging service
- [ ] Set up health check monitoring
- [ ] Document production credentials securely

---

## 📞 Quick Reference

### Important URLs
- **Health Check:** http://localhost:5000/health
- **Supabase Dashboard:** https://supabase.com/dashboard
- **API Base:** http://localhost:5000/api

### Important Files
- **Environment:** `server/.env`
- **Database Schema:** `database/schema_with_rls.sql`
- **API Docs:** `API_DOCUMENTATION.md`
- **Setup Guide:** `SETUP_GUIDE.md`

### Quick Commands
```bash
# Start server
npm run dev

# Check health
curl http://localhost:5000/health

# View Docker logs
docker-compose logs -f backend

# Stop Docker
docker-compose down
```

---

## 🎉 Success Indicators

You're ready to go when:

✅ Server starts without errors
✅ Health check returns success
✅ Can register a patient
✅ OTP email is sent
✅ Can verify OTP
✅ Can login and get Patient ID
✅ Can access dashboard
✅ Can upload medical records
✅ Patient data is isolated
✅ Rate limiting works
✅ Audit logs are created

---

**Deployment Status:** Ready for Testing ✅
**Last Updated:** February 14, 2026
