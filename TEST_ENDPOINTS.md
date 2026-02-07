# API Testing Guide

## Base URL
```
http://localhost:3000/api/v1
```

## 🔐 Authentication Flow

### 1. Sign Up (Create New User)
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass@123",
    "confirm_password": "SecurePass@123",
    "role": "client",
    "full_name": "John Doe",
    "timezone": "America/New_York"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Verification OTP sent to email",
  "user_id": "usr_abc123",
  "email": "john@example.com"
}
```

> ⚠️ Check your email for the OTP! Or check the server logs:
```bash
# In another terminal
tail -f C:\Users\UJJWAL~1\AppData\Local\Temp\claude\d--DownloadsD-paycassoBackendV3-Paycasso-Backend-V3\tasks\b1f9f58.output | grep "OTP"
```

---

### 2. Verify Email with OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": {
      "id": "usr_abc123",
      "email": "john@example.com",
      "role": "client",
      "email_verified": true
    }
  }
}
```

> 💡 **Save the `access_token`!** You'll need it for authenticated requests.

---

### 3. Resend OTP (if needed)
```bash
curl -X POST http://localhost:3000/api/v1/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

---

### 4. Sign In (Existing User)
```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass@123"
  }'
```

---

## 👤 User Profile Endpoints

### 5. Get My Profile (Full Details)
```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "id": "usr_abc123",
  "email": "john@example.com",
  "full_name": "John Doe",
  "role": "client",
  "bio": null,
  "timezone": "America/New_York",
  "profile_completeness": 55,
  "badges": ["email_verified"],
  "trust_score": 0,
  "total_ratings": 0,
  "completed_contracts": 0,
  "wallet_connected": false,
  "created_at": "2026-02-07T16:16:17.123Z"
}
```

---

### 6. Update Profile
```bash
curl -X PATCH http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Experienced project manager looking for quality freelancers",
    "skills": ["Project Management", "Agile", "Scrum"],
    "country": "United States",
    "profile_picture_url": "https://example.com/profile.jpg"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile_completeness": 75,
  "badges": ["email_verified"]
}
```

---

### 7. Search Users (Find Freelancers)
```bash
curl -X GET "http://localhost:3000/api/v1/users/search?role=freelancer&min_trust_score=4.5&skills=React&page=1&limit=20"
```

**Query Parameters:**
- `query` - Text search (name, bio, skills)
- `role` - client | freelancer
- `min_trust_score` - Minimum trust score (0-5)
- `skills` - Array of skills to match
- `country` - Filter by country
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `sort` - Sort field (trust_score, -trust_score, completed_contracts, etc.)

**Response:**
```json
{
  "users": [
    {
      "id": "usr_xyz789",
      "full_name": "Jane Developer",
      "role": "freelancer",
      "bio": "Full-stack developer specializing in React and Node.js",
      "skills": ["React", "Node.js", "TypeScript"],
      "badges": ["email_verified", "wallet_connected", "top_rated"],
      "trust_score": 4.9,
      "total_ratings": 47,
      "completed_contracts": 42,
      "member_since": "2024-08-20T15:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 8. Get User Public Profile
```bash
curl -X GET http://localhost:3000/api/v1/users/usr_xyz789
```

---

### 9. Get User Ratings
```bash
curl -X GET "http://localhost:3000/api/v1/users/usr_xyz789/ratings?page=1&limit=10"
```

**Response:**
```json
{
  "user_id": "usr_xyz789",
  "average_rating": 4.9,
  "total_ratings": 47,
  "rating_breakdown": {
    "overall": 4.9,
    "communication": 4.8,
    "quality": 5.0,
    "professionalism": 4.9,
    "timeliness": 4.8,
    "distribution": {
      "5": 42,
      "4": 5,
      "3": 0,
      "2": 0,
      "1": 0
    }
  },
  "ratings": [
    {
      "id": "rat_123",
      "rating": 5,
      "communication": 5,
      "quality": 5,
      "comment": "Excellent work, delivered on time!",
      "escrow_id": "esc_abc456",
      "reviewer": {
        "id": "usr_abc123",
        "name": "John Doe",
        "role": "client"
      },
      "created_at": "2025-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 47,
    "total_pages": 5
  }
}
```

---

### 10. Submit a Rating (Post-Escrow)
```bash
curl -X POST http://localhost:3000/api/v1/users/ratings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "escrow_id": "esc_abc123",
    "rated_user_id": "usr_xyz789",
    "overall_rating": 5,
    "communication_rating": 5,
    "quality_rating": 5,
    "professionalism_rating": 5,
    "timeliness_rating": 5,
    "comment": "Amazing work! Very professional and delivered ahead of schedule."
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "rating_id": "rat_abc123"
}
```

> ⚠️ **Note:** Rating submission will be validated against escrow completion in the next phase when the Escrow module is fully implemented.

---

## 🔑 Other Auth Endpoints

### Change Password
```bash
curl -X PUT http://localhost:3000/api/v1/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "SecurePass@123",
    "new_password": "NewSecurePass@456"
  }'
```

### Forgot Password
```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### Reset Password
```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456",
    "new_password": "NewSecurePass@456",
    "confirm_password": "NewSecurePass@456"
  }'
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Delete Account
```bash
curl -X DELETE http://localhost:3000/api/v1/auth/account \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePass@123",
    "confirmation": "DELETE MY ACCOUNT"
  }'
```

---

## 🧪 Testing with Postman/Thunder Client

### Import Collection
1. Open Postman or Thunder Client (VS Code extension)
2. Create a new collection called "Paycasso API"
3. Set base URL variable: `{{base_url}} = http://localhost:3000/api/v1`
4. Set auth variable: `{{access_token}} = <paste token after login>`
5. Use Bearer Token authentication for protected endpoints

### Test Flow
1. **Sign Up** → Save `user_id`
2. **Verify Email** → Save `access_token`
3. **Get My Profile** → Check profile completeness
4. **Update Profile** → Add bio, skills, etc.
5. **Get My Profile** again → See updated completeness %
6. **Search Users** → Find freelancers
7. **Get User Ratings** → Check freelancer reputation

---

## 📊 Database Schema Overview

Your database now has these tables:
- `users` - User accounts with profiles
- `otp_tokens` - Email verification & password reset OTPs
- `ratings` - User ratings & reviews
- `wallets` - Blockchain wallet info (coming soon)
- `escrows` - Escrow contracts (coming soon)
- `milestones` - Milestone-based payments (coming soon)
- `transactions` - Blockchain transactions (coming soon)

---

## 🐛 Debugging Tips

### Check Server Logs
```bash
tail -f C:\Users\UJJWAL~1\AppData\Local\Temp\claude\d--DownloadsD-paycassoBackendV3-Paycasso-Backend-V3\tasks\b1f9f58.output
```

### Check for OTPs in Logs
```bash
tail -f C:\Users\UJJWAL~1\AppData\Local\Temp\claude\d--DownloadsD-paycassoBackendV3-Paycasso-Backend-V3\tasks\b1f9f58.output | grep "OTP"
```

### Reset Database (if needed)
```bash
node reset-database.js
```

### Restart Server
```bash
# Stop current server (Ctrl+C in the terminal where it's running)
# Or kill the process
npm run start:dev
```

---

## ✨ What's Working

✅ **Auth Module**
- Sign up with email verification
- OTP-based email verification
- Sign in / Sign out
- Password reset flow
- Change password
- Account deletion

✅ **User Profile Module**
- Get own profile (full details)
- Update profile
- Profile completeness calculation
- Badge system
- Public profile view
- Advanced user search
- Get user ratings
- Submit ratings

⏳ **Coming Next**
- Wallet Management (Coinbase CDP integration)
- Escrow System (core platform feature)
- Dispute Resolution
- Notifications

---

## 🎯 Quick Test Script (Windows PowerShell)

```powershell
# 1. Sign Up
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/signup" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"SecurePass@123","confirm_password":"SecurePass@123","role":"client","full_name":"Test User","timezone":"America/New_York"}'

# 2. Check server logs for OTP
# Then verify email (replace OTP with actual value from logs)
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/verify-email" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","otp":"123456"}'

$token = $response.data.access_token

# 3. Get profile
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/users/me" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $token"}
```

---

## 📚 API Documentation

Full interactive API documentation available at:
```
http://localhost:3000/api/docs
```

This Swagger UI shows:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Try-it-out functionality
- Example values

---

Enjoy building your escrow platform! 🚀
