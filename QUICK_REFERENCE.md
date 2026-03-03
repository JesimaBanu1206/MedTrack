# 🚀 MedTrack Backend - Quick Reference

## ⚡ Quick Commands

### Development
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker-compose up --build
docker-compose logs -f backend
docker-compose down
```

---

## 🔑 Essential Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_ACCESS_SECRET=generate-64-char-secret
JWT_REFRESH_SECRET=generate-64-char-secret
SMTP_USER=sih1620hs@gmail.com
SMTP_PASS=livcnogunkyepynw
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📡 API Quick Reference

### Base URL
```
http://localhost:5000/api
```

### Auth Endpoints

**Register:**
```bash
POST /auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass@123"
}
```

**Verify OTP:**
```bash
POST /auth/verify-otp
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Login:**
```bash
POST /auth/login
{
  "phone": "9876543210",
  "password": "SecurePass@123"
}
```

**Refresh Token:**
```bash
POST /auth/refresh-token
# Uses cookie automatically
```

### Patient Endpoints (Requires Auth)

**Dashboard:**
```bash
GET /patient/dashboard
Authorization: Bearer YOUR_TOKEN
```

**Upload Record:**
```bash
POST /patient/medical-records/upload
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

file: [PDF/JPG/PNG file]
category: LAB_REPORT
description: Test results
```

**Get Records:**
```bash
GET /patient/medical-records?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

---

## 🗄️ Database Quick Setup

### 1. Create Supabase Project
- Go to supabase.com
- Create new project
- Copy URL and Service Role Key

### 2. Run Schema
```sql
-- Execute in Supabase SQL Editor
-- File: database/schema_with_rls.sql
```

### 3. Create Storage Bucket
- Name: `medical-records`
- Type: Private
- Apply RLS policies from schema

---

## 🔐 Security Checklist

- [x] JWT tokens (15min access, 7d refresh)
- [x] bcrypt password hashing (12 rounds)
- [x] OTP email verification
- [x] Rate limiting (auth, OTP, uploads)
- [x] Helmet security headers
- [x] CORS protection
- [x] Input validation (Joi)
- [x] File validation (magic numbers)
- [x] Row Level Security (RLS)
- [x] Audit logging
- [x] Data isolation

---

## 📊 Patient ID Format

```
PT-YYYY-XXXX

Examples:
PT-2026-0001
PT-2026-0002
PT-2027-0001
```

- Generated on first login
- Persistent across devices
- Never regenerated

---

## 🚨 Common Issues & Solutions

### Issue: Missing Supabase credentials
```bash
# Check .env file exists
ls server/.env

# Verify variables loaded
node -e "require('dotenv').config({path:'./server/.env'}); console.log(process.env.SUPABASE_URL)"
```

### Issue: OTP not sending
- Check SMTP credentials
- Verify email in console logs
- Check spam folder

### Issue: CORS errors
```env
# Update CLIENT_URL in .env
CLIENT_URL=http://localhost:5173
```

### Issue: File upload fails
- Verify bucket name: `medical-records`
- Check bucket is private
- Verify RLS policies applied

---

## 📁 File Structure

```
server/src/
├── config/          # Configuration
├── controllers/     # Business logic
├── middleware/      # Request processing
├── routes/          # API endpoints
├── utils/           # Helper functions
└── server.js        # Entry point
```

---

## 🧪 Test Flow

```bash
# 1. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","phone":"9876543210","password":"Test@123"}'

# 2. Check console for OTP

# 3. Verify OTP
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'

# 4. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"Test@123"}'

# 5. Save token and test dashboard
curl -X GET http://localhost:5000/api/patient/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📈 Rate Limits

| Endpoint | Window | Max |
|----------|--------|-----|
| Auth | 15 min | 5 |
| OTP | 10 min | 3 |
| Upload | 1 hour | 20 |
| API | 15 min | 100 |

---

## 🔧 Useful Commands

```bash
# Check server health
curl http://localhost:5000/health

# View Docker logs
docker-compose logs -f backend

# Restart Docker
docker-compose restart backend

# Clean Docker
docker-compose down -v

# Check Node version
node --version

# Check npm version
npm --version
```

---

## 📝 Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

Example: `SecurePass@123`

---

## 📞 Quick Links

- **Setup Guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **API Docs:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Full README:** [README_BACKEND.md](README_BACKEND.md)
- **Supabase:** https://supabase.com/dashboard

---

## 💡 Pro Tips

1. **Generate strong JWT secrets:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Check OTP in development:**
   - Look in terminal console logs
   - OTP is logged when sent

3. **Test with Postman:**
   - Import endpoints from API_DOCUMENTATION.md
   - Save tokens as environment variables

4. **Monitor logs:**
   ```bash
   # Development
   npm run dev

   # Docker
   docker-compose logs -f backend
   ```

5. **Database queries:**
   - Use Supabase SQL Editor
   - Check audit_logs table for security events

---

**Last Updated:** February 14, 2026
