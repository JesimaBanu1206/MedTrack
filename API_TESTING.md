# MedTrack API Testing Collection

## Base URL
```
http://localhost:5000/api/v1
```

## 1. Health Check
```http
GET http://localhost:5000/health
```

Expected Response:
```json
{
  "status": "OK",
  "timestamp": "2026-02-12T12:30:00.000Z",
  "environment": "development",
  "uptime": 123.456
}
```

---

## 2. Register User

```http
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "phone": "9876543210",
  "email": "patient@test.com",
  "password": "SecurePass123",
  "role": "PATIENT",
  "fullName": "John Doe"
}
```

Expected Response:
```json
{
  "success": true,
  "message": "Registration successful. OTP sent to your email.",
  "data": {
    "userId": "uuid-here",
    "phone": "9876543210",
    "email": "patient@test.com",
    "otpSent": true,
    "otp": "123456"  // Only in development
  }
}
```

---

## 3. Verify OTP

```http
POST {{baseUrl}}/auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456"
}
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP verified successfully. Your account is now active!"
}
```

---

## 4. Resend OTP

```http
POST {{baseUrl}}/auth/resend-otp
Content-Type: application/json

{
  "phone": "9876543210"
}
```

---

## 5. Login

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "password": "SecurePass123"
}
```

Expected Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "phone": "9876543210",
      "email": "patient@test.com",
      "role": "PATIENT",
      "isVerified": true
    }
  }
}
```

**Note:** Refresh token is set as HttpOnly cookie automatically.

---

## 6. Refresh Access Token

```http
POST {{baseUrl}}/auth/refresh
Cookie: refreshToken=<token-from-login>
```

Expected Response:
```json
{
  "success": true,
  "message": "Access token refreshed",
  "data": {
    "accessToken": "new-access-token-here"
  }
}
```

---

## 7. Change Password (Protected)

```http
POST {{baseUrl}}/auth/change-password
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "currentPassword": "SecurePass123",
  "newPassword": "NewSecurePass456"
}
```

---

## 8. Logout

```http
POST {{baseUrl}}/auth/logout
Cookie: refreshToken=<token>
```

Expected Response:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Phone and password are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid phone or password"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Your account has been deactivated. Please contact support."
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "User with this phone or email already exists"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many authentication attempts. Please try again after 15 minutes."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Testing Flow

1. **Register** → Get OTP via email
2. **Verify OTP** → Account activated
3. **Login** → Get access token + refresh token (cookie)
4. **Use Protected Routes** → Include `Authorization: Bearer <token>`
5. **Token Expires** → Use refresh endpoint
6. **Logout** → Clear tokens

---

## Postman Environment Variables

Create these variables in Postman:

```
baseUrl: http://localhost:5000/api/v1
accessToken: (set after login)
phone: 9876543210
```

---

## cURL Examples

### Register
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","email":"test@example.com","password":"Test@1234"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"Test@1234"}' \
  -c cookies.txt
```

### Protected Route
```bash
curl -X POST http://localhost:5000/api/v1/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"currentPassword":"Test@1234","newPassword":"NewPass@1234"}'
```
