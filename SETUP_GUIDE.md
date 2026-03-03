# 🏥 MedTrack Healthcare Platform - Backend Setup Guide

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Docker Deployment](#docker-deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18.x or higher
- **npm** v9.x or higher
- **Supabase Account** (for PostgreSQL database)
- **Git** (for version control)
- **Docker & Docker Compose** (optional, for containerized deployment)

---

## 📦 Installation

### Step 1: Clone the Repository
```bash
cd c:\Users\Windows\Desktop\Health\MT\MedTrack
```

### Step 2: Install Backend Dependencies
```bash
cd server
npm install
```

---

## 🗄️ Database Setup

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note down your:
   - Project URL
   - Service Role Key (anon key won't work for admin operations)
   - Database Password

### Step 2: Run Database Schema

#### Option A: Using Supabase SQL Editor
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `database/schema_with_rls.sql`
4. Paste and execute the SQL

#### Option B: Using psql (Command Line)
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres" -f database/schema_with_rls.sql
```

### Step 3: Create Supabase Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Create a new bucket named: `medical-records`
3. Set bucket to **Private** (not public)
4. Configure bucket policies:

```sql
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own medical records"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-records' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read their own medical records"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-records' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own medical records"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'medical-records' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 4: Verify Database Setup

Run this query in Supabase SQL Editor to verify:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if roles are inserted
SELECT * FROM roles;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## ⚙️ Environment Configuration

### Step 1: Create .env File

```bash
cd server
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit the `.env` file with your actual values:

```env
# Server
NODE_ENV=development
PORT=5000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres

# JWT Secrets (Generate using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_ACCESS_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-secret-here

# Email (Already configured for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sih1620hs@gmail.com
SMTP_PASS=livcnogunkyepynw

# Client
CLIENT_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,image/jpeg,image/jpg,image/png
```

### Step 3: Generate JWT Secrets

Run this command to generate secure secrets:

```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste into your `.env` file.

---

## 🚀 Running the Application

### Development Mode

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5000`

### Production Mode

```bash
cd server
npm start
```

### Verify Server is Running

Open your browser or use curl:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "MedTrack API is running",
  "timestamp": "2026-02-14T09:30:00.000Z",
  "environment": "development"
}
```

---

## 🐳 Docker Deployment

### Step 1: Create .env File in Root

Create `.env` file in the root directory (same level as docker-compose.yml):

```env
# Copy all variables from server/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
# ... etc
```

### Step 2: Build and Run with Docker Compose

```bash
# Build and start services
docker-compose up --build

# Run in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Step 3: Verify Docker Deployment

```bash
# Check running containers
docker ps

# Check backend health
curl http://localhost:5000/health
```

---

## 🧪 Testing

### Manual API Testing

Use the provided test cases in `API_TESTING.md` or use tools like:
- **Postman**
- **Thunder Client** (VS Code extension)
- **curl**

### Example: Register a Patient

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "password": "SecurePass@123"
  }'
```

### Example: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "password": "SecurePass@123"
  }'
```

---

## 🔧 Troubleshooting

### Issue: "Missing Supabase URL or Key"

**Solution:** Verify your `.env` file has correct Supabase credentials.

```bash
# Check if .env exists
ls -la server/.env

# Verify environment variables are loaded
node -e "require('dotenv').config({path: './server/.env'}); console.log(process.env.SUPABASE_URL)"
```

### Issue: "Failed to connect to database"

**Solution:** 
1. Check Supabase project is active
2. Verify DATABASE_URL is correct
3. Check firewall/network settings
4. Ensure Supabase service role key is used (not anon key)

### Issue: "OTP email not sending"

**Solution:**
1. Verify SMTP credentials are correct
2. Check Gmail app password is valid
3. Enable "Less secure app access" if using personal Gmail
4. Check email logs in console

### Issue: "CORS errors"

**Solution:** Update CLIENT_URL in `.env` to match your frontend URL:

```env
CLIENT_URL=http://localhost:5173
```

### Issue: "Rate limit exceeded"

**Solution:** Adjust rate limits in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

### Issue: "File upload fails"

**Solution:**
1. Verify Supabase storage bucket exists
2. Check bucket is named exactly `medical-records`
3. Verify storage policies are configured
4. Check file size is under MAX_FILE_SIZE

---

## 📝 Additional Notes

### Security Checklist for Production

- [ ] Change NODE_ENV to `production`
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Use environment-specific Supabase projects
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Enable Supabase RLS policies
- [ ] Review and test rate limits
- [ ] Set up error tracking (e.g., Sentry)

### Recommended Tools

- **API Testing:** Postman, Thunder Client
- **Database Management:** Supabase Dashboard, pgAdmin
- **Monitoring:** PM2, New Relic, DataDog
- **Logging:** Winston, Morgan
- **Error Tracking:** Sentry, Rollbar

---

## 📞 Support

For issues or questions:
- Check the `API_TESTING.md` file for API documentation
- Review the `QUICKSTART.md` for quick reference
- Check Supabase documentation: https://supabase.com/docs

---

**Last Updated:** February 14, 2026
**Version:** 1.0.0
