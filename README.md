# HavenCheck

## Overview

HavenCheck is a monorepo for domiciliary-style care operations: one **Node.js** backend (Express + Prisma + PostgreSQL), a **React Native (Expo)** mobile app, and a **Next.js** web portal. All product data is org-scoped; users authenticate with JWTs from the HavenCheck API (`/api` and `/api/v1`).

## Repository layout

```
.
├── backend/          # REST API, Prisma schema, migrations, seed
├── mobile-app/       # React Native (Expo) app (carer, manager, admin, guardian)
├── web-portal/       # Next.js web app (carer, manager, admin, guardian)
└── docs/             # CAPABILITIES.md (as-built); prd/ module notes; module index
```

## Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, etc.
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed    # optional; creates demo users and sample data
npm run dev            # http://localhost:3001
```

### Mobile app

```bash
cd mobile-app
npm install
npm start
# optional: EXPO_PUBLIC_API_ORIGIN, EXPO_PUBLIC_API_PORT — see mobile-app/README.md
```

### Web portal

```bash
cd web-portal
npm install
# create .env.local — see web-portal/README.md
npm run dev            # http://localhost:3000
```

Automated alternative: `./setup.sh` or follow `QUICK_SETUP.md` / `SETUP_GUIDE.md`.

## Test credentials (after seed)

Organisation code for API login: **`HFL`**

| Role    | Email                 | Password  |
|---------|----------------------|-----------|
| Admin   | admin@havenflow.com  | admin123  |
| Manager | manager@havenflow.com | manager123 |
| Carer   | carer1@havenflow.com | carer123  |

---

## Implemented capabilities

Each subsection describes behaviour that exists in **backend + API + UI** today. **`docs/CAPABILITIES.md`** mirrors this content by module for engineers who want a single narrative without role headings.

### Mobile app — carer

#### Overview

Field carers run visits from the mobile app: rota, clock in/out, checklists, notes, medications, and a read-only active care plan for the visit client.

#### Key capabilities

- Today’s visits and weekly rota
- Clock in / clock out with GPS coordinates (and late clock-in reason when required)
- Visit detail: checklists, notes, medication due list, medication events (administered / omitted) with PRN and signature fields where required
- Visit history
- Open shifts: browse, apply, withdraw application
- Availability windows
- Offline queue for clock events and medication events when the device is offline (`mobile-app/src/services/offline/`)
- **Care plan (read-only):** from visit detail, open **Active care plan** — loads `GET /api/visits/:visitId/care-plan` and shows the current **ACTIVE** structured plan for that visit’s client

#### How it works

The app calls the legacy **`/api`** base for visits (`/api/visits/...`) and **`/api/v1`** for open shifts and other v1 routes. The user signs in with email, password, and organisation code; the JWT is stored and sent on subsequent requests.

### Mobile app — manager and admin

#### Overview

Manager and admin accounts use tab navigation with dashboard-style and roster configuration screens backed by the same APIs as the web portal (clients, carers, schedules, visits, checklists, availability, open-shift staffing).

#### Key capabilities

- Tab bar: **Dashboard**, **Clients**, **Carers** (further screens such as schedules, visits, checklists, open shifts, availability, profile are available from the drawer where implemented)

#### How it works

Same auth as carers; role determines which navigator (`ManagerTabs` / `AdminTabs`) loads after login.

### Mobile app — guardian

#### Overview

Guardian accounts see a read-only **family feed** when linked to a client.

#### Key capabilities

- **Family feed** tab: structured cards for visits, notes, and incidents; client filter chips; background refresh; registers an Expo push token when notifications are permitted (`GuardianFeedScreen`, `expo-notifications`)
- **Care alerts** tab: inbox from **`GET /api/v1/carer/messages/inbox`** (visit-complete and incident notifications appear here)
- No carer-only tabs (rota, open shifts, history) in the guardian navigator

#### How it works

Guardian JWT calls **`GET /api/guardian/feed`** (legacy base) or **`GET /api/v1/guardian/feed`** with optional `clientId` and `since`. **`POST /api/v1/guardian/device`** stores `expoPushToken`. Guardians do not clock in or record medications.

### Web portal — carer

#### Overview

Carers who sign in on the web use a slim portal: day view, visits list, roster view, open shifts, availability, and visit detail (clock in/out using browser geolocation, notes). In-app messages use the same **`GET /api/v1/carer/messages/inbox`** API as mobile but are not linked from the default carer nav (managers use broadcast flows; guardians use **Care alerts** in the guardian nav).

#### Key capabilities

- **My day** (`/dashboard`), **My visits** (`/visits`), **My roster** (`/schedules` — read-oriented schedule list), **Open shifts** (`/open-shifts`), **Availability** (`/availability`), **Care alerts** (`/messages` — carer inbox), visit detail with clock in/out and notes (`/visits/[id]`)

#### How it works

JWT in `localStorage`; `NEXT_PUBLIC_API_URL` points at the backend `/api` prefix (see `web-portal/lib/api.ts`).

### Web portal — manager

#### Overview

Managers configure the service, monitor today’s activity, run the interactive rota board, and use compliance/report areas wired to the backend.

#### Key capabilities

- **Team overview** (`/manager/overview`), **Team rota** (`/manager/team-rota` — week board, drag-and-drop reassignment, server-side validation), **Open shifts** (listing and detail flows under `/manager/open-shifts`), **Compliance** (`/manager/compliance` — date-range dashboard, CSV ZIP or single-section CSV, PDF inspection pack via `GET /api/v1/manager/compliance/dashboard` and `GET /api/v1/manager/compliance/inspection-pack`), **Reports** (`/manager/reports`)
- Shared with historical admin-style routes where applicable: **Clients**, **Carers**, **Schedules**, **Visits**, **Checklists**, **Availability** (same sidebar section as in `Layout.tsx` for manager users)

#### How it works

Manager JWT calls `/api/v1/manager/...` and legacy `/api/...` routes as implemented in `backend/src/routes/manager.ts` and `backend/README.md`.

### Web portal — admin

#### Overview

Admins have full organisation configuration: people, schedules, clinical (eMAR, care plans, risk), finance exports, incidents, guardians, and audit.

#### Key capabilities

- **Admin** area (`/admin/...`): clients (including structured profile JSON, medications, care plan, risk assessments), carers, schedules, visits, MAR chart, compliance summaries, medication exceptions, **care plan review queue** (`/admin/care-plans`), **risk templates listing** (`/admin/risk-assessments`), **billing** (`/admin/billing`), **payroll** (`/admin/payroll`), **reports** (`/admin/reports`), **guardians** (`/admin/guardians`); **audit log** is available via `GET /api/v1/admin/audit-logs` (no dedicated admin web page in this repo)
- **Incidents** (`/incidents`) — create and list incidents, severity summary, interactive body-map capture; escalation / follow-up / action APIs exist but are not all exposed on this page (see `docs/prd/PRD-003-incidents-body-maps-guardian-feed.md`)
- **Guardian web** — family feed (`/guardian`) and care alerts (`/messages`)

#### How it works

Admin JWT uses `/api/v1/admin/...` plus the same legacy `/api` routes as managers where roles overlap.

### Structured care plans and risk assessments

#### Overview

Care plans are stored as versioned **sections** (needs, strengths, risks, actions) in PostgreSQL — not as unstructured file uploads. Risk assessments use org templates with weighted scoring; results persist with score breakdown.

#### Key capabilities

- **Care plans (v1):** list/create/patch plans, new versions, org template library (`GET`/`POST /api/v1/care-plans/templates`), review dates and reminder timestamps, overdue and reminder listing endpoints, mark reminder sent
- **Web:** per-client editor and version workflow (`/admin/clients/[id]/care-plan`), org review dashboard (`/admin/care-plans`), template picker and editable sections in the UI
- **Risk (v1):** seeded org templates (falls, pressure sores, nutrition), scored assessments with persisted `scoreBreakdown`, optional link to a care plan
- **Web:** per-client assessments UI (`/admin/clients/[id]/risk-assessments`), live score preview and saved breakdown display

#### How it works

Managers and admins mutate plans via `/api/v1/care-plans`; carers consume the active plan only through **`GET /api/visits/:visitId/care-plan`** on the legacy visits router (same visit access rules as `GET /api/visits/:id`).

### eMAR (electronic medication administration)

#### Overview

Medications and schedules are configured per client (admin). Optional stock is stored on **`MedicationStock`**. Carers record **MedicationEvent** rows against visits; the system enforces audit logging, immutability rules, soft delete, stock decrement when tracking is enabled, **medication alerts** (missed scheduled dose in a closed visit, late vs schedule time, PRN frequency, low stock), and reporting endpoints in the API docs.

#### Key capabilities

- Admin client medication and schedule CRUD (v1), optional stock on **`MedicationStock`**, MAR chart CSV export, compliance and omission-derived exception summaries
- **Admin → MAR** (`/admin/mar`): medication **alerts** list, acknowledge, optional **Run alert detection**; server-side cron when **`ENABLE_MED_ALERT_CRON=1`**
- Mobile visit detail: due medications for the visit window, record administration or omission with validation (PRN, signature, reasons)
- Web visit detail: read medication history for a visit

#### How it works

Carer recording uses **`POST /api/visits/:visitId/med-events`** (and **`/api/v1/visits/...`** where mounted). Admin configuration uses **`/api/v1/admin/clients/:clientId/medications`** and schedules. Alert APIs: **`/api/v1/emar/alerts`**, **`/api/v1/emar/alerts/:id/acknowledge`**, **`/api/v1/emar/alerts/run-detection`**, plus **`/api/v1/emar/exceptions`** — see `backend/README.md` and `backend/API_IMPLEMENTATION.md`.

### Incidents, body maps, guardian

#### Overview

Structured incidents with escalations, follow-ups, actions, and body-map entries; guardians are linked to clients and see an allowed subset via feed APIs.

#### Key capabilities

- REST CRUD-style flows under `/api/v1/incidents` and legacy `/api/incidents` (mirrored)
- Guardian invite and feed under `/api/v1/guardian`
- Web: incidents workspace (`/incidents`), guardian family feed and care alerts (`/guardian`, `/messages`), admin guardian linking (`/admin/guardians`)
- Mobile: guardian family feed and care alerts tabs

#### How it works

Authenticated staff create and update incidents; guardians use only guardian routes with `GUARDIAN` role.

### Billing and payroll

#### Overview

Finance outputs are built from **completed** visits with clock-in/out. **Billing** produces per-client **invoices** with line items from **rate cards** (organisation default or **client-specific**). **Payroll** produces per-carer **payslips** with hours, mileage pay, holiday accrual, optional **expense reimbursements**, and **net pay**. **REST:** `MANAGER` or **ADMIN** JWT. **Web:** pages live under `/admin/...` (admin-only Next layout), so managers use the **API** or an admin account for the UI.

#### Key capabilities

- **Rate cards:** `GET` / `POST` / `PATCH /api/v1/billing/rate-cards` — hourly or fixed billing, payroll hourly rate, mileage and holiday fields; optional `clientId`, `contractRef`, effective dates; optional JSON **`billingModifiers`** (e.g. `weekendHourlyMultiplier` for **Saturday/Sunday UTC** on generated invoice lines)
- **Invoices:** list (`GET .../billing/invoices`, optional `?status=`, `?clientId=`), generate (`POST .../billing/invoices/generate`), detail (`GET .../billing/invoices/:id`), status (`PATCH .../billing/invoices/:id` — `DRAFT` → `ISSUED` / “sent” → `PAID`, or `VOID`), CSV (`GET .../invoices/:id/export/xero` or `.../export/csv`)
- **Payslips:** list, generate (`POST .../payroll/payslips/generate`), detail (`GET .../payslips/:id`), update (`PATCH .../payslips/:id` — `status`; **expense reimbursements** while `DRAFT`), visit **mileage override** (`PATCH .../payroll/visits/:visitId/mileage-override`), line items include **mileageSource** (`GPS` | `OVERRIDE` | `NONE`), CSV export
- **Web (admin layout):** `/admin/billing`, `/admin/payroll` — full flows including invoice/payslip detail, lifecycle buttons, expense editor, mileage override form

#### How it works

Generate endpoints scan completed visits in the ISO period, resolve the applicable rate card per visit (`backend/src/lib/rateCardResolve.ts`), and persist totals and JSON line items. Staff then update **invoice status** or **payslip status** / **expenses** via `PATCH` or the admin web UI. **Mileage:** GPS distance from clock coordinates vs client location unless `Visit.mileageMilesOverride` is set (then payslip lines use **OVERRIDE**).

Module note: **`docs/prd/PRD-004-billing-payroll-reporting-v1.md`**.

### Scheduling and team rota

#### Overview

Schedules and visits share the same underlying model; managers move work between carers from the web team rota with server-side overlap and eligibility checks.

#### Key capabilities

- `GET /api/v1/manager/team-rota/week`, `GET /api/v1/manager/team-rota/suggestions/:scheduleId`, `PATCH /api/v1/manager/team-rota/reassign/:id` (path parameter is the **schedule** id; body `{ "carerId" }`)
- Web `/manager/team-rota` interactive board

#### How it works

PATCH reassign sends `{ carerId }`; the API returns structured errors for conflicts or skill mismatches.

### Audit, reporting, messaging

#### Overview

Cross-cutting services: organisation audit log for successful v1 mutations, bundled enterprise metrics, and manager → carer messaging.

#### Key capabilities

- `AuditLog` middleware for successful mutating `/api/v1/*` calls (see `backend/src/index.ts`), plus **explicit** `AuditLog` rows for incident lifecycle actions, care plan create/update/version/reminder, medication events (and blocked edits / soft deletes) on visits, and compliance inspection-pack downloads
- `GET /api/v1/admin/reports/enterprise`, existing MAR / timesheet / compliance report routes
- `POST /api/v1/manager/messages/carer/:carerId`, `POST .../messages/broadcast`, `GET /api/v1/carer/messages/inbox` (carers and **guardians** — same router allows `GUARDIAN` JWT for read)

#### How it works

Reporting endpoints accept `from` / `to` (and optional filters) as documented in `backend/API_IMPLEMENTATION.md`.

---

## Tech stack

- **Backend:** Node.js, TypeScript, Express, Prisma, PostgreSQL, JWT
- **Mobile:** React Native, Expo, TypeScript
- **Web:** Next.js, TypeScript, Tailwind CSS

## Environment notes

- Backend: `backend/.env.example` (optional **`ENABLE_MED_ALERT_CRON=1`** for periodic medication alert detection across organisations)
- Mobile: `EXPO_PUBLIC_API_ORIGIN` / `EXPO_PUBLIC_API_PORT` — see `mobile-app/README.md`
- Web: `NEXT_PUBLIC_API_URL` — see `web-portal/README.md`

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/CAPABILITIES.md` | Shipped behaviour by module (structured mirror of this file’s facts) |
| `backend/API_IMPLEMENTATION.md` | `/api/v1` route reference |
| `backend/README.md` | Legacy `/api` routes and server setup |
| `SETUP_GUIDE.md` / `QUICK_SETUP.md` | Local environment setup |
| `web-portal/README.md` | Web app env and structure |
| `mobile-app/README.md` | Mobile app env and structure |
| `TESTING_READINESS_REPORT.md` | Manual QA prerequisites and smoke checks |
| `docs/prd/PRD-*.md` | Short **as-built** notes per domain |
| `docs/prd/ENGINEERING-BACKLOG-PLAN.md` | Archived pointer — use `README.md` |
| `COMPETITIVE_ANALYSIS_TODO.md` | Archived pointer — use `README.md` |
| `HAVENFLOW_CARER_APP_SPEC.md` | Archived pointer — use `README.md` and `backend/API_IMPLEMENTATION.md` |
