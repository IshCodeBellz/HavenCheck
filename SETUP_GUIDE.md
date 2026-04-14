# Haven Flow App - Complete Setup Guide

This guide will walk you through setting up all components of the Haven Flow Carer App.

## Prerequisites

- Node.js (v20 or higher; aligns with Next.js and current tooling—use active LTS if unsure)
- PostgreSQL database
- npm or yarn
- For mobile app: Expo Go app on your phone or iOS Simulator/Android Emulator

## Step 1: Backend Setup

### 1.1 Navigate to backend directory
```bash
cd backend
```

### 1.2 Install dependencies
```bash
npm install
```

### 1.3 Create environment file
Create a `.env` file in the `backend` directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/havenflow?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production-min-32-characters"
PORT=3001
NODE_ENV=development
```

**Important:** 
- Replace `user`, `password`, `localhost`, and `5432` with your PostgreSQL credentials
- Use a strong random string for `JWT_SECRET` (at least 32 characters)

### 1.4 Create PostgreSQL database
```sql
CREATE DATABASE havenflow;
```

### 1.5 Generate Prisma Client
```bash
npm run prisma:generate
```

### 1.6 Run database migrations
```bash
npm run prisma:migrate
```

When prompted, name your migration: `init`

### 1.7 Seed the database (optional but recommended)
```bash
npm run prisma:seed
```

This creates test users:
- **Admin**: `admin@havenflow.com` / `admin123`
- **Manager**: `manager@havenflow.com` / `manager123`
- **Carer**: `carer1@havenflow.com` / `carer123`

### 1.8 Start the backend server
```bash
npm run dev
```

The backend should now be running at `http://localhost:3001`

You can test it by visiting: `http://localhost:3001/health`

## Step 2: Mobile App Setup

### 2.1 Navigate to mobile-app directory
```bash
cd ../mobile-app
```

### 2.2 Install dependencies
```bash
npm install
```

### 2.3 Update API URL (if needed)
Edit `src/services/api.ts` and update the `API_BASE_URL` if your backend is running on a different URL or port.

### 2.4 Start Expo development server
```bash
npm start
```

This will:
- Start the Metro bundler
- Show a QR code in the terminal
- Open Expo DevTools in your browser

### 2.5 Run on device/simulator

**For iOS:**
```bash
npm run ios
```

**For Android:**
```bash
npm run android
```

**Or scan QR code:**
- Install Expo Go app on your phone
- Scan the QR code from the terminal

## Step 3: Web Portal Setup

### 3.1 Navigate to web-portal directory
```bash
cd ../web-portal
```

### 3.2 Install dependencies
```bash
npm install
```

### 3.3 Create environment file
Create a `.env.local` file in the `web-portal` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3.4 Start development server
```bash
npm run dev
```

The web portal should now be running at `http://localhost:3000`

## Step 4: Verify Setup

### Backend Health Check
```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Test Login (Backend)
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@havenflow.com","password":"admin123"}'
```

Should return a token and user object.

### Web Portal
1. Open `http://localhost:3000` in your browser
2. You should be redirected to `/login`
3. Login with: `admin@havenflow.com` / `admin123`
4. You should see the dashboard

### Mobile App
1. Open the app on your device/simulator
2. Login with: `carer1@havenflow.com` / `carer123`
3. You should see "Today's Visits" screen

## Troubleshooting

### Backend Issues

**Database connection error:**
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env` file
- Ensure database exists

**Prisma migration errors:**
- Make sure database is empty or use `prisma migrate reset` (⚠️ deletes all data)
- Check Prisma schema syntax

**Port already in use:**
- Change PORT in `.env` file
- Or stop the process using port 3001

### Mobile App Issues

**Cannot connect to backend:**
- Ensure backend is running
- Check API_BASE_URL in `src/services/api.ts`
- For physical device: Use your computer's IP address instead of `localhost`
- Ensure device and computer are on same network

**Expo errors:**
- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Web Portal Issues

**API errors:**
- Check NEXT_PUBLIC_API_URL in `.env.local`
- Ensure backend is running
- Check browser console for errors

## Next Steps

1. **Configure production environment variables**
2. **Set up CI/CD pipeline**
3. **Configure geofencing radius for clients**
4. **Create checklist templates**
5. **Add more users and schedules**

## Development Tips

- Use Prisma Studio to view/edit database: `npm run prisma:studio` (in backend directory)
- Backend API: `backend/API_IMPLEMENTATION.md` (v1); `backend/README.md` (legacy `/api/*` overview)
- Mobile app structure: See `mobile-app/README.md`
- Web portal structure: See `web-portal/README.md`

## Support

For issues or questions, refer to:
- Backend: `backend/README.md`
- Mobile App: `mobile-app/README.md`
- Web Portal: `web-portal/README.md`
- Full Specification: `HAVENFLOW_CARER_APP_SPEC.md`

