# HavenCheck — quick setup

Get the stack running locally for development and testing (about five minutes).

---

## Prerequisites Check

Before starting, ensure you have:

- Node.js installed (v20 or higher; use the current LTS if unsure)
- PostgreSQL installed and running
- npm or yarn package manager

---

## Step 1: Backend setup (about 3 minutes)

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

Backend should now be running at `http://localhost:3001`

**Test it:**
```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 2: Web portal setup (about 1 minute)

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

Web portal should now be running at `http://localhost:3000`

---

## Step 3: Mobile app setup (about 1 minute)

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

## Verification checklist

### Backend
- [ ] Server starts without errors
- [ ] Health check returns OK: `curl http://localhost:3001/health`
- [ ] Can login (seed org code is `HFL`): `curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@havenflow.com","organizationCode":"HFL","password":"admin123"}'`

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
  -d '{"email":"admin@havenflow.com","organizationCode":"HFL","password":"admin123"}'

# Get current user (replace YOUR_TOKEN with token from login)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Next steps

Once everything is running:

1. Sign in as each role and confirm you reach the expected home screen (web and mobile).
2. On **mobile**, open a seeded visit: clock in, submit a checklist if configured, add a note, clock out.
3. On **web**, create or edit a client, open schedules or visits, and open **Admin → MAR** if you use medications. As **manager**, open **Compliance** (`/manager/compliance`) to confirm the dashboard loads for a date range.
4. Read **`README.md`** and **`backend/API_IMPLEMENTATION.md`** for supported features and HTTP routes.
5. For billing or payroll CSVs, complete visits with clock-in/out, configure rate cards in the API or UI, then use **Admin → Billing** or **Admin → Payroll**.

---

## Need help?

- `backend/SETUP.md` — backend detail  
- `TESTING_READINESS_REPORT.md` — QA scope and prerequisites  
- `backend/API_IMPLEMENTATION.md` — API tables  

---

Setup is complete when health checks pass and you can sign in with the seeded users.

