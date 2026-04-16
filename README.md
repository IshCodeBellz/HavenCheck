# Haven Flow Carer App

A comprehensive mobile and web system for Haven Flow care staff management.

## Project Structure

```
.
├── backend/          # Node.js + TypeScript REST API
├── mobile-app/       # React Native (Expo) mobile app
├── web-portal/       # Next.js admin portal
└── HAVENFLOW_CARER_APP_SPEC.md  # Full specification document
```

## Quick Start

### Backend

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT secret
```

4. Set up database:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

5. Start server:
```bash
npm run dev
```

Backend runs on `http://localhost:3001`

### Mobile App

1. Navigate to mobile-app directory:
```bash
cd mobile-app
```

2. Install dependencies:
```bash
npm install
```

3. Update API URL in `src/services/api.ts` if needed

4. Start Expo:
```bash
npm start
```

5. Run on device/simulator:
```bash
npm run ios
# or
npm run android
```

### Web Portal

1. Navigate to web-portal directory:
```bash
cd web-portal
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables:
```bash
# Create .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

4. Start development server:
```bash
npm run dev
```

Web portal runs on `http://localhost:3000`

## Test Credentials

From backend seed data:
- **Admin**: `admin@havenflow.com` / `admin123`
- **Manager**: `manager@havenflow.com` / `manager123`
- **Carer**: `carer1@havenflow.com` / `carer123`

## Features

### Mobile App (Carer)
- View today's visits
- Weekly rota view
- Clock in/out with GPS
- Complete care checklists
- Add notes and handover
- View visit history

### Mobile App (Manager/Admin)
- Today overview
- Team rota view
- Active carers tracking

### Web Portal (Carer)
- My day (today’s visits overview and map)
- My visits (history and filters)
- My roster (read-only schedule list)
- Availability
- Visit details: clock in/out (browser location), notes

### Web Portal (Manager/Admin)
- Dashboard with statistics
- Clients CRUD
- Carers management
- Schedules management (create/edit/delete)
- Visits listing
- Checklist template management

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, Prisma, PostgreSQL
- **Mobile**: React Native, Expo, TypeScript
- **Web**: Next.js, TypeScript, Tailwind CSS

## Environment Notes

- Backend defaults and optional settings are documented in `backend/.env.example`.
- Mobile app API origin can be configured with `EXPO_PUBLIC_API_ORIGIN` (with Expo host auto-detection fallback in development).

## Quick Setup

For fastest setup, run the automated setup script:
```bash
./setup.sh
```

Or follow the detailed guide in `QUICK_SETUP.md`.

## Documentation

- **Specification**: `HAVENFLOW_CARER_APP_SPEC.md` - Complete specification document
- **API Documentation**: `backend/API_IMPLEMENTATION.md` - API endpoints reference
- **Setup Guide**: `QUICK_SETUP.md` - Step-by-step setup instructions
- **Testing Readiness**: `TESTING_READINESS_REPORT.md` - Comprehensive testing readiness assessment

## Testing Readiness

✅ **The app is ready for testing!** See `TESTING_READINESS_REPORT.md` for:
- Complete readiness assessment
- Pre-testing checklist
- Testing recommendations
- Troubleshooting guide

