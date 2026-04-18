# HavenCheck — web portal

Next.js application for carers, managers, admins, and guardians on the HavenCheck API.

## Overview

JWT auth (`localStorage`) and Axios (`lib/api.ts`) call the backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`). Role-specific navigation is defined in `components/Layout.tsx`.

## Key capabilities

### Carer (web)

* **My day** (`/dashboard`), **My visits** (`/visits`), **My roster** (`/schedules`), **Open shifts** (`/open-shifts`), **Availability** (`/availability`)  
* Visit detail: clock in/out (browser geolocation), notes (`/visits/[id]`)

### Guardian (web)

* **Family feed** (`/guardian`)  
* **Care alerts** (`/messages`) — same inbox API as mobile (`GET /api/v1/carer/messages/inbox`)  
* Nav: Family feed + Care alerts; logo targets `/guardian`; `/dashboard` redirects guardians to the feed

### Manager

* Team overview, team rota, open shifts, compliance, reports (`/manager/*`) plus shared staff routes (clients, carers, schedules, visits, checklists, availability)

### Admin

* `/admin/*` — clients (profile JSON, medications, care plan, risk), carers, schedules, visits, MAR, care-plan review queue, risk templates, billing, payroll, reports, guardians, etc.

### Optional Supabase middleware

`middleware.ts` wires `utils/supabase/middleware.ts`. If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are **absent**, middleware skips Supabase session work; core HavenCheck pages use the REST API only. The browser helper `utils/supabase/client.ts` is not imported by default app routes—add keys only if you extend the app with Supabase-backed pages.

## How it works

```bash
cd web-portal
npm install
# .env.local — minimum:
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001/api' > .env.local
npm run dev   # http://localhost:3000
```

## Project structure (high level)

```
app/
  ├── dashboard/       # Carer "my day"
  ├── visits/          # Lists + [id] detail
  ├── schedules/       # Roster
  ├── guardian/        # Family feed
  ├── messages/        # Care alerts inbox
  ├── manager/         # Overview, team-rota, open-shifts, compliance, reports
  ├── admin/           # Full admin subtree
  ├── incidents/       # Staff incidents + body maps
  └── login/           # Auth entry
components/
  └── Layout.tsx       # Primary navigation shell
lib/
  ├── api.ts           # Axios client → NEXT_PUBLIC_API_URL
  └── auth.ts          # Session helpers
```
