# HavenCheck — shipped capabilities

This document describes **only** behaviour that exists end-to-end: **backend logic**, **HTTP API routes** (including legacy `/api` mirrors where present), and **UI** (web and/or mobile). For route-level detail, use `backend/API_IMPLEMENTATION.md` and `backend/README.md`.

---

## Authentication and organisation

### Overview

Users authenticate with email, password, and organisation code. JWTs gate all protected routes.

### Key capabilities

* Login and session (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`; mirrored under `/api/auth/*`).
* Email verification flow for new accounts (Resend when `RESEND_API_KEY` is configured; see `backend/.env.example`).
* Web: login, signup, verify-email, resend-verification, create-organisation, account pages.

### How it works

The web portal and mobile app store the JWT after login and send `Authorization: Bearer <token>` on API calls. Organisation membership is resolved server-side from the user record.

---

## Carer field workflows (mobile + web)

### Overview

Carers manage assigned visits: rota, clock-in/out with coordinates, checklists, notes (including handover), visit history, open-shift applications, and availability windows.

### Key capabilities

* **Mobile:** Today’s visits, weekly schedule, visit detail (clock in/out, checklist, notes, medications), history, open shifts (list/apply/withdraw where applicable), availability, profile. Offline queue retries failed clock and medication-event requests (`mobile-app/src/services/offline/`).
* **Web:** My day (dashboard with map when data allows), visits list and filters, visit detail (clock in/out using browser geolocation, notes), roster (read-only schedules), availability.
* **API:** Carer router accepts **CARER** and **GUARDIAN** JWTs; handlers that compare `visit.carerId` to the current user remain **carer-only**. Guardians use **`GET /api/v1/carer/messages/inbox`** for alert threads alongside **`GET /api/v1/guardian/feed`** (`/api/v1/carer/*` and legacy `/api/carer/*`).

### How it works

Schedules create visits. The carer opens a visit, clocks in within geofencing rules on the legacy visit clock-in path, completes checklists and notes on the visit, and clocks out. Completed visits drive payroll/billing elsewhere.

---

## Guardian (family) access

### Overview

Guardian accounts have read-only visibility into linked clients via a feed, in-app alerts, optional email and push notifications, and (on mobile) Expo push token registration.

### Key capabilities

* **Feed:** `GET /api/v1/guardian/feed` (and `/api/guardian/feed`) — merged items for completed visits, notes, and incidents permitted by `GuardianLink`; optional `clientId` and `since` (ISO) for polling. Structured JSON (headlines, client names, visit durations, incident fields).
* **Device:** `POST /api/v1/guardian/device` — stores `expoPushToken` on the user (guardian-only).
* **Invite (staff):** `POST /api/v1/guardian/invite` — manager/admin links a guardian user to a client with visibility flags.
* **Notifications:** On visit completion and new incident, linked guardians receive in-app messages (`Message`/`MessageThread`), optional transactional email (verified email + Resend), and Expo push when a token is stored.
* **Web:** `/guardian` (family feed), `/messages` (care alerts inbox via `GET /api/carer/messages/inbox`), navigation tailored for `GUARDIAN`; dashboard redirects to the feed.
* **Mobile:** Family feed and care alerts tabs; push permission and token registration on feed load when `expo-notifications` is available; guardian does not see carer-only tabs (rota, open shifts, history).

### How it works

Staff invite a guardian user and set permissions. The guardian signs in on web or mobile, sees the feed and alerts, and receives notifications when visits complete or incidents are created for a linked client.

---

## Manager operations (web + mobile)

### Overview

Managers oversee the organisation: rota, operational reports, compliance snapshot, open shifts, and messaging to carers.

### Key capabilities

* **Web:** Dashboard, team overview, team rota (week board, reassignment suggestions, validated reassignment), open shifts (list/create/detail), compliance page (`/manager/compliance`), **Reports** (`/manager/reports`) with operational exports, clients/carers/schedules/visits/checklists/availability (shared staff navigation where applicable).
* **Mobile:** Tab bar for Dashboard, Clients, Carers; drawer access to open shifts, schedules, visits, checklists, availability, profile (same underlying admin-style screens as mobile admin in many cases).
* **API:** `GET /api/v1/manager/overview/today`, team rota week/suggestions/reassign, open-shift listings, `POST .../messages/carer/:carerId`, `POST .../messages/broadcast`, compliance under `/api/v1/manager/compliance/*` (`dashboard`, `inspection-pack` with CSV/PDF/ZIP per `backend/src/routes/compliance.ts`).

### How it works

Managers use the web portal for rota and reporting; mobile provides a lighter subset for monitoring and edits on the go.

---

## Admin operations (web + mobile)

### Overview

Admins have full organisation configuration: users, clients, schedules, eMAR setup, care plans and risk, incidents tooling, guardians, billing and payroll, audit stream, and consolidated reports.

### Key capabilities

* **Web:** Admin section pages under `/admin/*` (clients, carers, schedules, visits, timesheets, MAR, medications per client, care plans and review queue, risk templates and assessments, guardians, billing, payroll, reports, users as implemented). Organisation audit history is available through **`GET /api/v1/admin/audit-logs`** (no dedicated audit browser page in the portal).
* **Mobile:** Admin tab navigator with dashboard, clients, carers, schedules, visits, checklists, admin availability, profile; staff open-shift flows where wired.
* **API:** `/api/v1/admin/*` routes for CRUD on org entities, reporting, audit logs, eMAR admin endpoints (see `backend/API_IMPLEMENTATION.md`).

### How it works

Admins configure the organisation on web; mobile supports a subset of admin screens for convenience.

---

## Electronic medication (eMAR)

### Overview

Medications and schedules are defined per client; optional stock lives on **`MedicationStock`**. Carers record administration or omission on visits with auditability, MAR reporting, omission summaries, and **medication alerts** (missed scheduled dose in a closed visit window, late administration vs schedule time, PRN frequency threshold, low stock).

### Key capabilities

* **Data:** `Medication`, `MedicationStock` (optional 1:1), `MedicationSchedule`, `MedicationEvent`, `MedicationAuditLog`, `MedicationAlert`.
* **Carer recording:** `GET /api/visits/:id/medications`, `GET /api/visits/:id/due-medications`, `POST /api/visits/:id/med-events` (and `/api/v1/visits/...` where mounted); stock decrement when `MedicationStock.currentStock` is set; in-app alert + notify when stock crosses reorder threshold.
* **Admin / reporting:** MAR chart, CSV export, medication compliance, **`GET /api/v1/emar/exceptions`**, **`GET /api/v1/emar/alerts`**, **`PATCH /api/v1/emar/alerts/:id/acknowledge`**, **`POST /api/v1/emar/alerts/run-detection`** (legacy `/api/emar/*` mirrors); admin client medication UI; **Admin → MAR**; visit detail on web shows medication history.
* **Cron:** set **`ENABLE_MED_ALERT_CRON=1`** on the API host to run detection for all organisations on a timer (see `backend/src/index.ts`).

### How it works

Admin defines medications, optional stock, and schedules. On a visit, the carer records due medications, captures signatures where required, and omissions with reasons. The server evaluates alert rules on demand or on the cron schedule; admins acknowledge alerts from the MAR page.

---

## Structured care plans and risk assessments

### Overview

Versioned care plans with sections and review metadata; risk templates and scored assessments optionally linked to a care plan.

### Key capabilities

* **API:** `/api/v1/care-plans/*`, `/api/v1/risk-assessments/*` (templates, client lists, create/update/version flows as implemented in `carePlans.ts` and `risk.ts`).
* **Web:** `/admin/care-plans`, `/admin/risk-assessments`, per-client `/admin/clients/[id]/care-plan`, `/admin/clients/[id]/risk-assessments`.
* **Mobile (carer):** Care plan summary screen where navigation is enabled from visit detail.

### How it works

Managers or admins maintain templates and client artefacts; carers read the active care plan summary from the visit context on mobile.

---

## Incidents and body maps

### Overview

Staff record incidents with severity and workflow actions; body map entries capture structured coordinates (and optional imagery references) for evidence.

### Key capabilities

* **API:** `POST/GET` incidents, escalate, follow-ups, actions, body-map create and list (`/api/v1/incidents/*` and legacy `/api/incidents/*`).
* **Web:** `/incidents` interactive page for logging and body map capture.
* **Backend:** Persists `GuardianFeedEvent` on incident creation for audit-style family pipeline data; guardian notifications are also sent via the notification service.

### How it works

Staff creates an incident (and optional body map). Guardians with permission see corresponding feed items and notifications.

---

## Billing and payroll

### Overview

Rate cards describe billing and payroll rates per organisation (and optionally per client). **Invoices** and **payslips** are generated from **completed** visits with clock-in/out. Invoices support a **draft → sent (`ISSUED`) → paid** lifecycle (or void). Payslips support **draft → finalized → paid**, optional **expense reimbursements** while draft, **net pay**, and **visit mileage overrides** that replace GPS-derived miles when set.

### Key capabilities

* **API:** `/api/v1/billing/*`, `/api/v1/payroll/*` (mirrored under `/api/billing`, `/api/payroll`); **MANAGER** or **ADMIN** JWT.
  * Billing: rate cards (optional `billingModifiers` JSON, e.g. weekend hourly multiplier for Sat/Sun UTC on generated lines), list/generate invoices, `GET`/`PATCH` invoice by id, status filter on list, per-invoice CSV.
  * Payroll: list/generate payslips, `GET`/`PATCH` payslip by id, `PATCH` visit mileage override, per-payslip CSV (includes mileage source and net pay).
* **Web (admin-only layout):** `/admin/billing`, `/admin/payroll` — full UI for the above (managers use API unless given an admin account for these pages).

### How it works

Staff maintain rate cards, run **generate** for an ISO period, then adjust **invoice** or **payslip** state and expenses via `PATCH` or the admin web UI. CSV exports support hand-off to spreadsheets or accounting tools.

---

## Reporting, compliance exports, and audit

### Overview

Operational metrics, CSV-oriented operational reports, compliance inspection packs, and server-side audit trails support oversight.

### Key capabilities

* **Enterprise metrics:** `GET /api/v1/admin/reports/enterprise?from&to` — bundled metrics including missed/completed/late visits, medication compliance, **hours delivered** / **total_hours**, **revenue** (issued and paid invoices overlapping the range), **payroll_costs** (sum of payslip net pay over overlapping periods), incidents, active clients, visit completion rate (`backend/src/services/reportingService.ts`).
* **MAR / timesheets / medication compliance:** Admin report endpoints per `API_IMPLEMENTATION.md`.
* **Operational reports (JSON + CSV export):** `GET /api/v1/manager/reports/ops/*` and the same paths on the admin router — missed visits, medication compliance, hours delivered, incidents, payroll summary (each with an `/export` route where implemented in `orgReporting.ts`).
* **Manager compliance UI:** `/manager/compliance` calls `GET /api/v1/manager/compliance/dashboard` and `GET /api/v1/manager/compliance/inspection-pack` (CSV, ZIP, or PDF depending on query parameters).
* **Audit log API:** `GET /api/v1/admin/audit-logs` reads organisation-scoped `AuditLog` rows. Rows are created by v1 mutation middleware and by explicit writers for incidents, care plan changes, medication events on visits, manager messaging, and compliance inspection-pack downloads; medication row history also uses `MedicationAuditLog`.

### How it works

Admins and managers open **Reports** or **Compliance** in the web portal to run queries for a date range and download CSV/ZIP/PDF where offered. Integrations or support staff call the audit-log endpoint directly when a UI is not required.

---

## Messaging

### Overview

Managers broadcast or direct messages to carers; carers and guardians read their inbox.

### Key capabilities

* **API:** `POST /api/v1/manager/messages/carer/:carerId`, `POST /api/v1/manager/messages/broadcast`; `GET /api/v1/carer/messages/inbox` (recipients include guardians for alert-style threads created by the system).

### How it works

Manager sends a message; carers and guardians see rows in the inbox UI (web `/messages` for guardians; mobile care alerts tab for guardians).

---

## Open shifts

### Overview

Organisations post open shifts; carers apply; managers process listings (web and API).

### Key capabilities

* Web manager and carer flows under `/manager/open-shifts`, `/open-shifts`; mobile staff/carer screens as wired in navigation; backend routes under manager and carer services for listings and applications.

### How it works

Manager publishes a shift; carers apply from mobile or web; managers manage from the manager UI.

---

## Platform and infrastructure

### Overview

Node.js (Express) + Prisma + PostgreSQL backend; Next.js web; Expo mobile.

### Key capabilities

* Health and readiness endpoints (`/health`, `/ready`).
* CORS and security middleware as configured in `backend/src/index.ts`.
* Web middleware may initialise Supabase SSR helpers when env vars are present; core HavenCheck flows use the REST API with JWT.

### How it works

Services run locally per `QUICK_SETUP.md`; clients point `NEXT_PUBLIC_API_URL` (web) or Expo API origin env vars (mobile) at the backend `/api` base.

---

## Documentation map

| Document | Purpose |
|----------|---------|
| `README.md` | Monorepo overview, quick start, role-oriented capability index |
| `docs/CAPABILITIES.md` | This file — module narrative (as built) |
| `backend/API_IMPLEMENTATION.md` | `/api/v1` route reference |
| `backend/README.md` | Legacy `/api/*` paths and server setup |
| `docs/prd/PRD-001-emar-core.md` | eMAR module notes |
| `docs/prd/PRD-002-care-plans-risk-assessments.md` | Care plans and risk notes |
| `docs/prd/PRD-003-incidents-body-maps-guardian-feed.md` | Incidents, body maps, guardian notes |
| `docs/prd/PRD-004-billing-payroll-reporting-v1.md` | Billing, payroll, reporting notes |
| `docs/prd/ENGINEERING-BACKLOG-PLAN.md` | Archived pointer (see `README.md`) |
| `COMPETITIVE_ANALYSIS_TODO.md` | Filename retained; content is a factual capability inventory |
| `mobile-app/README.md` | Mobile setup |
| `web-portal/README.md` | Web portal setup |
