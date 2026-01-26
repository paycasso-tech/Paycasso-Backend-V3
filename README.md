# Escrow Platform Backend - Phase 1

This is the NestJS backend for the Escrow Platform, featuring fintech-grade security and a modular architecture.

## Status: Phase 1 (Authentication & Foundation)
- ✅ Project Structure (Clean Architecture)
- ✅ Database Schema (Users, OTPs)
- ✅ Authentication (Signup, Login, Verify Email)
- ✅ Security (JWT, Argon2/Bcrypt, Rate Limiting, Helmet)
- ✅ API Documentation (Swagger)

## Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis (Optional for implementing cache store)

## Setup

1. **Install Dependencies** (If not already done):
   ```bash
   npm install
   npm install --save-dev @types/bcrypt
   ```

2. **Configure Environment**:
   - Rename `.env.example` to `.env` (already created as `.env`)
   - Update `DATABASE_URL` with your Postgres credentials.

3. **Run Database Migrations** (Auto-sync enabled for dev):
   The application uses TypeORM `synchronize: true` for development. Just running the app will create tables.

## Running the App

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation
Once running, visit: http://localhost:3000/api/docs

## Architecture
- **src/core**: Domain entities and business logic (Use Cases).
- **src/infrastructure**: Database, external services (Email, Redis).
- **src/interfaces**: Controllers, Middlewares, Routes.
- **src/shared**: Utilities, Constants, Errors.
