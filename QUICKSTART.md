# MedTrack - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Database Setup

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Open SQL Editor
3. Copy and paste the entire content from `database/schema.sql`
4. Click "Run"
5. Copy your database connection string

### Step 2: Environment Configuration

**Backend (.env in server folder):**
```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
DATABASE_URL=your_supabase_connection_string
JWT_ACCESS_SECRET=generate-random-32-char-string
JWT_REFRESH_SECRET=generate-random-32-char-string
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
```

**Get Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Search "App passwords"
4. Generate password for "Mail"
5. Copy the 16-character password

### Step 3: Install & Run

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend (new terminal):**
```bash
cd client
npm install
npm run dev
```

### Step 4: Test API

**Register User:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "email": "test@example.com",
    "password": "Test@1234"
  }'
```

Check your email for OTP (or check server console in dev mode).

**Verify OTP:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "otp": "123456"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "password": "Test@1234"
  }'
```

## 🐳 Docker Quick Start

**One Command Deployment:**

```bash
# 1. Create .env file in root
cp .env.example .env

# 2. Edit .env with your credentials

# 3. Run
docker-compose up -d

# 4. Check logs
docker-compose logs -f
```

Access:
- Frontend: http://localhost
- Backend: http://localhost:5000
- Health: http://localhost:5000/health

## 📱 Test Credentials (Development)

After registration, use these for testing:

**Patient:**
- Phone: 9876543210
- Password: Test@1234

**Doctor (create manually in DB):**
- Phone: 9876543211
- Password: Doctor@123
- Role: DOCTOR

## 🔧 Common Issues

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Database Connection Failed
- Check Supabase connection string
- Ensure IP is whitelisted in Supabase
- Verify SSL mode is correct

### Email Not Sending
- Use Gmail App Password (not regular password)
- Enable "Less secure app access" if needed
- Check SMTP settings

## 📊 Project Status

✅ Authentication System (Complete)
✅ JWT Access + Refresh Tokens (Complete)
✅ OTP Email Verification (Complete)
✅ Role-Based Access Control (Complete)
✅ Docker Configuration (Complete)
⏳ Patient Management (Next)
⏳ Appointment System (Next)
⏳ Emergency Module (Next)

## 🎯 Next Steps

1. **Frontend Development**: Build React components
2. **Patient Module**: Registration, profile, medical records
3. **Doctor Module**: Dashboard, appointments, EHR
4. **Emergency Module**: GPS tracking, ambulance dispatch
5. **Admin Module**: Hospital management, analytics

## 📞 Support

- Documentation: See README.md
- Issues: Open GitHub issue
- Email: support@medtrack.com

---

**Happy Coding! 🚀**
