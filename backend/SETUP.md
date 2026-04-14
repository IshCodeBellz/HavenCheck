# Backend Setup Instructions

## Prerequisites

1. PostgreSQL database (local or remote)
2. Node.js installed

## Setup Steps

### 1. Create Environment File

Create a `.env` file in the backend directory with the following content:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/havenflow?schema=public"
JWT_SECRET="your-secret-key-change-in-production-min-32-chars"
PORT=3001
NODE_ENV=development
```

**Important:** Replace the `DATABASE_URL` with your actual PostgreSQL connection string.

### 2. Create Database

Make sure your PostgreSQL database exists. If not, create it:

```sql
CREATE DATABASE havenflow;
```

### 3. Run Database Migrations

```bash
npm run prisma:migrate
```

This will create all the database tables.

### 4. Seed Database (Optional)

```bash
npm run prisma:seed
```

This will create test users:
- Admin: `admin@havenflow.com` / `admin123`
- Manager: `manager@havenflow.com` / `manager123`
- Carer: `carer1@havenflow.com` / `carer123`

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

### New API v1 Structure

- `/api/v1/auth/*` - Authentication
- `/api/v1/carer/*` - Carer-specific endpoints
- `/api/v1/manager/*` - Manager-specific endpoints
- `/api/v1/admin/*` - Admin-specific endpoints

### Legacy Routes (for backward compatibility)

- `/api/auth/*` - Authentication
- `/api/users/*` - Users
- `/api/clients/*` - Clients
- `/api/visits/*` - Visits
- `/api/schedules/*` - Schedules
- `/api/checklists/*` - Checklists
- `/api/notes/*` - Notes

## Testing

You can test the API using curl or Postman:

```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@havenflow.com","password":"admin123"}'

# Get current user (use token from login)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

