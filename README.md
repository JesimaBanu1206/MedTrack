# 🏥 MedTrack Healthcare Platform

Production-grade healthcare management system built with React, Node.js, Express, and PostgreSQL.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Security](#security)

## 🚀 Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS
- React Router
- Axios
- Zustand (State Management)

### Backend
- Node.js 18+
- Express.js
- PostgreSQL (Supabase)
- JWT Authentication
- bcrypt
- Nodemailer

### DevOps
- Docker & Docker Compose
- Nginx
- Multi-stage builds

## 📁 Project Structure

```
MedTrack/
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/           # Axios instances
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Zustand stores
│   │   └── utils/         # Helper functions
│   ├── Dockerfile
│   └── nginx.conf
├── server/                # Express backend
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Custom middleware
│   │   ├── routes/        # API routes
│   │   └── utils/         # Utility functions
│   ├── Dockerfile
│   └── package.json
├── database/              # SQL schemas
│   └── schema.sql
├── docker-compose.yml
└── .env.example
```

## ✅ Prerequisites

- Node.js 18+ and npm
- PostgreSQL (or Supabase account)
- Docker & Docker Compose (for containerized deployment)
- Gmail account (for email OTP)

## 📦 Installation

### 1. Clone Repository

```bash
cd MedTrack
```

### 2. Setup Database

Run the SQL schema in your Supabase dashboard:

```bash
# Copy schema from database/schema.sql and execute in Supabase SQL Editor
```

### 3. Configure Environment Variables

**Backend:**
```bash
cd server
cp .env.example .env
# Edit .env with your credentials
```

**Root (for Docker):**
```bash
cd ..
cp .env.example .env
# Edit .env with your credentials
```

### 4. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ../client
npm install
```

## 🏃 Running Locally

### Backend

```bash
cd server
npm run dev
```

Server runs on `http://localhost:5000`

### Frontend

```bash
cd client
npm run dev
```

Frontend runs on `http://localhost:5173`

## 🐳 Docker Deployment

### 1. Build and Run

```bash
# Make sure .env file is configured
docker-compose up -d
```

### 2. View Logs

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 3. Stop Services

```bash
docker-compose down
```

### 4. Rebuild After Changes

```bash
docker-compose up -d --build
```

## 📡 API Documentation

### Authentication Endpoints

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phone": "9876543210",
  "email": "user@example.com",
  "password": "SecurePass123",
  "role": "PATIENT"
}
```

#### Verify OTP
```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "password": "SecurePass123"
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Cookie: refreshToken=<token>
```

#### Logout
```http
POST /api/v1/auth/logout
Cookie: refreshToken=<token>
```

## 🧪 Testing with Postman

### 1. Import Collection

Create a new Postman collection with the following environment variables:

```
BASE_URL: http://localhost:5000
ACCESS_TOKEN: (will be set after login)
```

### 2. Test Flow

1. **Register** → Get OTP in email (or check console in dev mode)
2. **Verify OTP** → Account activated
3. **Login** → Get access token
4. **Use Protected Routes** → Add `Authorization: Bearer <token>` header

## 🔒 Security Features

- ✅ bcrypt password hashing (12 rounds)
- ✅ JWT with short-lived access tokens (15m)
- ✅ HttpOnly cookies for refresh tokens
- ✅ Rate limiting on auth endpoints
- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ No plaintext passwords
- ✅ No Base64 file storage

## 🌐 Production Deployment

### Environment Variables

**Critical - Change in Production:**
- `JWT_ACCESS_SECRET` - Generate strong random string
- `JWT_REFRESH_SECRET` - Generate strong random string
- `SMTP_USER` and `SMTP_PASS` - Your email credentials
- `DATABASE_URL` - Your production database URL

### Recommended Hosting

- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend**: Railway, Render, or AWS ECS
- **Database**: Supabase (Pro plan for production)

## 📊 Database Maintenance

### Cleanup Expired Tokens

Run periodically (e.g., daily cron job):

```sql
SELECT cleanup_expired_tokens();
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support, email support@medtrack.com or open an issue.

---

**Built with ❤️ for Healthcare**
