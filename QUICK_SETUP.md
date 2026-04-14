# Quick Setup Guide
## Get Your App Ready for Testing in 5 Minutes

This guide will help you set up the Haven Flow Carer App for testing.

---

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js installed (v20 or higher; use the current LTS if unsure)
- ✅ PostgreSQL installed and running
- ✅ npm or yarn package manager

---

## Step 1: Backend Setup (3 minutes)

### 1.1 Navigate to Backend
```bash
cd backend
```

### 1.2 Install Dependencies
```bash
npm install
```

### 1.3 Create Environment File
Copy the example file and edit it:
```bash
cp .env.example .env
```

**Edit `.env` file** with your PostgreSQL credentials:
```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/havenflow?schema=public"
JWT_SECRET="change-this-to-a-random-secret-minimum-32-characters-long"
PORT=3001
NODE_ENV=development
```

**Important:** 
- Replace `YOUR_USER` and `YOUR_PASSWORD` with your PostgreSQL username and password
- Change `JWT_SECRET` to a secure random string (at least 32 characters)

### 1.4 Create Database
Open PostgreSQL and create the database:
```sql
CREATE DATABASE havenflow;
```

Or use command line:
```bash
createdb havenflow
```

### 1.5 Run Migrations
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 1.6 Seed Database (Creates Test Users)
```bash
npm run prisma:seed
```

This creates:
- **Admin**: `admin@havenflow.com` / `admin123`
- **Manager**: `manager@havenflow.com` / `manager123`
- **Carer**: `carer1@havenflow.com` / `carer123`

### 1.7 Start Backend Server
```bash
npm run dev
```

✅ Backend should now be running at `http://localhost:3001`

**Test it:**
```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 2: Web Portal Setup (1 minute)

### 2.1 Navigate to Web Portal
```bash
cd ../web-portal
```

### 2.2 Install Dependencies
```bash
npm install
```

### 2.3 Environment File (Already Created)
The `.env.local` file should already exist. If not, create it:
```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001/api' > .env.local
```

### 2.4 Start Web Portal
```bash
npm run dev
```

✅ Web portal should now be running at `http://localhost:3000`

---

## Step 3: Mobile App Setup (1 minute)

### 3.1 Navigate to Mobile App
```bash
cd ../mobile-app
```

### 3.2 Install Dependencies
```bash
npm install
```

### 3.3 Start Expo
```bash
npm start
```

This will open Expo DevTools. Then:
- Press `i` for iOS simulator (requires Xcode on Mac)
- Press `a` for Android emulator (requires Android Studio)
- Scan QR code with Expo Go app on your phone

---

## ✅ Verification Checklist

### Backend
- [ ] Server starts without errors
- [ ] Health check returns OK: `curl http://localhost:3001/health`
- [ ] Can login: `curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@havenflow.com","password":"admin123"}'`

### Web Portal
- [ ] Server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Login page loads

### Mobile App
- [ ] Expo starts without errors
- [ ] Can open app on device/simulator
- [ ] Login screen appears

---

## Troubleshooting

### Backend Issues

**Error: "Cannot connect to database"**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env` is correct
- Ensure database exists: `psql -l | grep havenflow`

**Error: "JWT_SECRET not configured"**
- Check `.env` file exists and has JWT_SECRET set
- Ensure JWT_SECRET is at least 32 characters

**Error: "Prisma Client not generated"**
- Run: `npm run prisma:generate`

### Web Portal Issues

**Error: "Cannot connect to API"**
- Verify backend is running on port 3001
- Check `.env.local` has correct API URL
- Restart Next.js dev server after changing `.env.local`

### Mobile App Issues

**Error: "Network request failed"**
- Ensure backend is running
- Check API URL in `src/services/api.ts` (should be `http://localhost:3001/api` for dev)
- For physical device: Use your computer's IP address instead of localhost

**Expo won't start**
- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

---

## Quick Test Commands

### Test Backend API
```bash
# Health check
curl http://localhost:3001/health

# Login as admin
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@havenflow.com","password":"admin123"}'

# Get current user (replace YOUR_TOKEN with token from login)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Next Steps

Once everything is running:

1. **Test Login** - Try logging in with each role (Admin, Manager, Carer)
2. **Test Mobile App** - Complete a visit flow (clock in, checklist, notes)
3. **Test Web Portal** - Create a client, assign schedules, view visits
4. **Review Documentation** - Check `TESTING_READINESS_REPORT.md` for detailed testing guide

---

## Need Help?

- Check `SETUP.md` in backend directory for detailed setup
- Review `TESTING_READINESS_REPORT.md` for comprehensive testing guide
- Check API documentation in `backend/API_IMPLEMENTATION.md`

---

**Setup Complete!** 🎉

Your app should now be ready for testing. Start with the backend, then web portal, then mobile app.

