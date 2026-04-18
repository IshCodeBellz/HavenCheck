# HavenCheck — backend API

Node/Express REST API for HavenCheck: visits and rostering, eMAR, care plans and risk, incidents and guardians, billing and payroll, audit and reporting.

**API v1:** See `API_IMPLEMENTATION.md` for `/api/v1/*` routes. This README lists legacy `/api/*` paths that the web portal and mobile app still use via the shared `/api` base URL.

## Tech Stack

- Node.js + TypeScript
- Express.js
- PostgreSQL + Prisma ORM
- JWT Authentication
- bcryptjs for password hashing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with required values (database, JWT, and app URLs)
```

Minimum required in local development:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (optional, defaults to 3001 in code)
- `NODE_ENV` (`development` for local)

Email verification and links:
- `WEB_APP_URL` (used to build verification links)
- `RESEND_API_KEY` (required in production to send emails)
- `EMAIL_FROM` (sender identity)

Network/runtime options:
- `CORS_ORIGIN` (required in production for browser clients)
- `TRUST_PROXY=1` when behind a reverse proxy/load balancer
- `UPLOAD_DIR` (optional, defaults to `uploads/client-documents`)

3. Set up database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

4. Start development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## Seeded Demo Access

After running `npm run prisma:seed`, you can log in with:

- Admin: `admin@havenflow.com` / `admin123`
- Manager: `manager@havenflow.com` / `manager123`
- Carer: `carer1@havenflow.com` / `carer123`

## Seeded Demo Data Snapshot

The default seed creates:

- Organization: `Haven Flow`
- Carers: `John Carer` and `Jane Carer`
- Clients:
  - `Malachi Bartolomeu` (paediatric complex care profile with structured `profile` JSON)
  - `Robert Johnson` (monitoring + nutrition profile sections)
- Next-day availability for both carers
- Two schedules and matching visits for the next day
- One checklist template: `Standard Care Checklist`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin/Manager)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (Admin)
- `PATCH /api/users/:id` - Update user

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create client (Admin/Manager)
- `PATCH /api/clients/:id` - Update client (Admin/Manager)
- `DELETE /api/clients/:id` - Delete client (Admin)

#### Admin Client Profile Payload Examples

`POST /api/clients` and `PATCH /api/clients/:id` accept a structured `profile` object.

Create example:
```json
{
  "name": "Malachi Bartolomeu",
  "address": "Flat1 Garret House, Brunner Road, London",
  "latitude": 51.5072,
  "longitude": -0.1276,
  "geofenceRadiusMeters": 150,
  "contactName": "Parent/Guardian",
  "contactPhone": "07412177589",
  "notes": "Paediatric complex care profile.",
  "profile": {
    "personal": {
      "preferredName": "Malachi",
      "dateOfBirth": "2015-06-21",
      "gender": "Male",
      "genderAtBirth": "Male",
      "pronouns": "He",
      "ethnicity": "African/British",
      "religion": "Christian"
    },
    "contactAndEmergency": {
      "primaryPhone": "07412177589",
      "email": "operations@dhamaltd.org",
      "communicationPreference": "Trusted Person",
      "emergencyRating": "MEDIUM",
      "familyContacts": [
        {
          "name": "Mum",
          "role": "Primary Guardian",
          "mobile": "07412177589",
          "isEmergencyContact": true
        }
      ]
    },
    "clinicalSummary": {
      "dnarOrRespectStatus": "Resuscitate",
      "medicalHistory": [
        "Born prematurely at 35+2 weeks",
        "Quadriplegic Cerebral Palsy",
        "Global developmental delay",
        "Severe visual impairment"
      ],
      "healthTags": ["Paediatric - Complex Medical Needs"],
      "heightMeters": 1.4,
      "weightKg": 32.2,
      "bmi": 16.43,
      "oxygenRequired": false,
      "catheterInUse": false,
      "nilByMouth": true
    },
    "allergiesAndAlerts": {
      "foodAllergies": [],
      "medicationAllergies": [],
      "riskAlerts": ["Aspiration risk"]
    },
    "careTeamAndDecisionMakers": {
      "involvedProfessionals": ["Dietician", "Physio", "Social Worker"],
      "decisionMakers": [
        {
          "name": "Parent/Guardian",
          "role": "Best Interest Decision Maker"
        }
      ]
    },
    "nutritionAndHydration": {
      "mainDiet": "Peptamen Junior Advance 1.5kcal/ml",
      "specialDiets": ["Nutritional Supplement"],
      "feedingRoute": "PEG",
      "feedingPlan": [
        {
          "name": "Breakfast feed",
          "time": "05:45",
          "frequency": "Rota Days",
          "instructions": "100ml via Flocare pump at 100ml/hr",
          "assignedTeam": ["All"]
        }
      ],
      "hydrationPlan": [
        {
          "name": "Bolus water",
          "time": "09:00",
          "frequency": "Daily",
          "instructions": "100ml via push",
          "assignedTeam": ["All"]
        }
      ]
    },
    "medicationSupport": {
      "selfManaged": false,
      "supportLevel": "Full support",
      "supportNeeds": [
        "Administer feeds and flushes",
        "Support PEG site care"
      ],
      "currentMedications": [
        {
          "name": "Dioralyte",
          "purpose": "Hydration support",
          "schedule": "Overnight as per plan",
          "route": "PEG"
        }
      ]
    },
    "dailyLivingAndMobility": {
      "mobilitySupport": "Full support for transfers and positioning",
      "equipment": ["Wheelchair", "Standing Frame", "Gantry Hoist"],
      "continenceSupport": "Nappy checks and changes",
      "oralCareSupport": "Twice daily brushing with minimal toothpaste",
      "positioningPlan": [
        {
          "name": "Reposition and comfort check",
          "time": "05:00",
          "frequency": "Daily",
          "instructions": "Check skin comfort and heel pads",
          "assignedTeam": ["All"]
        }
      ]
    },
    "monitoringAndObservations": {
      "vitalsSchedule": [
        { "vitalName": "Oxygen Saturation", "frequency": "Daily", "time": "23:45" },
        { "vitalName": "Heart Rate", "frequency": "Daily", "time": "23:45" }
      ],
      "observationInstructions": "Record all interventions in hourly notes."
    },
    "schedulesAndShiftTasks": {
      "dailyTasks": [
        {
          "name": "Hourly summary notes",
          "time": "00:00",
          "frequency": "Rota Days",
          "instructions": "Document observations and interventions.",
          "assignedTeam": ["All"]
        }
      ],
      "shiftHandoverRequirements": "Document handover at start and end of shift.",
      "startShiftChecks": [
        "Medication",
        "Feed pump",
        "Suction machine",
        "Supplies for next 3 shifts"
      ],
      "endShiftChecks": [
        "Clean used equipment",
        "Tidy environment",
        "Complete concern log"
      ],
      "hourlyLoggingRequired": true
    },
    "equipmentAndEnvironment": {
      "requiredEquipment": [
        "Feed pump",
        "Suction machine",
        "Standing frame",
        "Wheelchair"
      ],
      "environmentRequirements": [
        "Keep room and bathroom clean",
        "Keep equipment organised"
      ]
    },
    "personCentredInfoAndOutcomes": {
      "history": "Complex paediatric care background.",
      "routines": "Consistent routine is important.",
      "triggers": ["Unexpected changes in routine"],
      "calmingStrategies": ["Reassurance", "Familiar carers"],
      "likes": ["Structured routine"],
      "hobbies": [],
      "desiredOutcomes": [
        "Comfort and safety",
        "Stable hydration and nutrition"
      ]
    },
    "reviewAndAudit": {
      "carePlanStartDate": "2014-06-04",
      "wentLiveOn": "2024-07-17T13:15:00Z",
      "lastReviewedAt": "2025-10-28T18:27:00Z",
      "reviewedBy": "Admin"
    }
  }
}
```

Update example (partial payload):
```json
{
  "notes": "Updated feeding and monitoring instructions.",
  "profile": {
    "nutritionAndHydration": {
      "feedingPlan": [
        {
          "name": "Dinner feed",
          "time": "20:00",
          "frequency": "Rota Days",
          "instructions": "100ml via Flocare pump at 100ml/hr with 25ml flush",
          "assignedTeam": ["All"]
        }
      ]
    },
    "monitoringAndObservations": {
      "vitalsSchedule": [
        { "vitalName": "Temperature Check", "frequency": "Daily", "time": "18:15" }
      ]
    },
    "reviewAndAudit": {
      "lastReviewedAt": "2026-04-10T09:00:00Z",
      "reviewedBy": "Admin"
    }
  }
}
```

Notes:
- Unknown keys are rejected for client and profile payloads.
- `PATCH /api/clients/:id` is partial, but nested objects are replaced by what you send for that section.
- `POST` and `PATCH` require `ADMIN` or `MANAGER` role.

### Visits
- `GET /api/visits` - Get visits (filtered by role)
- `GET /api/visits/today` - Get today's visits
- `GET /api/visits/:id` - Get visit by ID
- `GET /api/visits/:id/care-plan` - Active structured **CarePlan** (status `ACTIVE`) for the visit’s client; same org and visit-access rules as `GET /api/visits/:id` (carers: assigned visit only)
- `POST /api/visits/:id/clock-in` - Clock in
- `POST /api/visits/:id/clock-out` - Clock out
- `GET /api/visits/:id/medications` - Active medications for visit client (includes flat `currentStock` / `reorderThreshold` from `MedicationStock` when present)
- `GET /api/visits/:id/due-medications` - Medications due in visit window (PRN always listed)
- `POST /api/visits/:id/med-events` - Create medication event (audit log on create; decrements `MedicationStock` when `currentStock` is tracked; low-stock alert + notify when at or below threshold)
- `PATCH /api/visits/:id/med-events/:eventId` - Blocked (immutable event); audit log only
- `DELETE /api/visits/:id/med-events/:eventId` - Soft-delete event; audit log

### eMAR (admin, `/api/v1/emar` and `/api/emar`)

- `GET /exceptions?from&to&clientId` - Omitted events and summary
- `GET /alerts` - Medication alerts (missed, late, PRN misuse, low stock); query `includeAcknowledged=1` to include cleared rows
- `PATCH /alerts/:alertId/acknowledge` - Acknowledge an alert
- `POST /alerts/run-detection` - Run detection rules once for the organisation

Optional server env: `ENABLE_MED_ALERT_CRON=1` runs scheduled detection for all organisations (see `src/index.ts`).

### Schedules
- `GET /api/schedules` - Get schedules
- `GET /api/schedules/weekly` - Get weekly rota
- `GET /api/schedules/:id` - Get schedule by ID
- `POST /api/schedules` - Create schedule (Admin/Manager)
- `PATCH /api/schedules/:id` - Update schedule (Admin/Manager)
- `DELETE /api/schedules/:id` - Delete schedule (Admin/Manager)

Create/update paths enforce carer availability and, where configured, **client DBS/certification rules** on `User` / `Client`. New optional fields on `Schedule` store **estimated travel** between consecutive visits when lat/lng exist.

### Manager scheduling (v1, `/api/v1/manager`)

Requires `MANAGER` or `ADMIN` JWT (same as other manager routes).

- `GET /api/v1/manager/team-rota/week?start=YYYY-MM-DD` — all carers; schedules grouped by calendar day
- `GET /api/v1/manager/team-rota/suggestions/:scheduleId` — ranked reassignment candidates
- `PATCH /api/v1/manager/team-rota/reassign/:id` — body `{ "carerId": "<userId>" }`; rejects overlaps and skill mismatches

Mirrored write paths also exist on `PATCH /api/v1/manager/schedules/:id` for standard schedule updates (org-scoped).

### Checklists
- `GET /api/checklists/templates` - Get all templates
- `GET /api/checklists/templates/:id` - Get template by ID
- `POST /api/checklists/templates` - Create template (Admin/Manager)
- `POST /api/checklists/visits/:visitId/submit` - Submit checklist
- `GET /api/checklists/visits/:visitId/submissions` - Get submissions

### Notes
- `GET /api/notes/visits/:visitId` - Get notes for visit
- `GET /api/notes/visits/:visitId/handover` - Get handover notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note by ID

### Incidents & body maps
- `POST /api/incidents` - Create incident (category, severity, safeguarding flag, optional visit link)
- `GET /api/incidents` - List incidents (org scope; optional `clientId`, `status` query)
- `POST /api/incidents/:incidentId/escalate` - Escalate (MANAGER/ADMIN)
- `POST /api/incidents/:incidentId/follow-ups` - Add follow-up item
- `POST /api/incidents/:incidentId/actions` - Add workflow action
- `POST /api/incidents/body-maps` - Save body map entry (`coordinates` JSON array, optional `images` URLs)
- `GET /api/incidents/clients/:clientId/body-maps` - List body map entries for a client

Same paths under `/api/v1/incidents`.

### Guardian
- `POST /api/guardian/invite` — Link guardian user to client; set read-only and feed visibility flags (**MANAGER/ADMIN**)
- `GET /api/guardian/feed` — **GUARDIAN** only; optional `clientId`, `since` (ISO); merged visits, notes, and incidents allowed by `GuardianLink` (structured JSON for UI)
- `POST /api/guardian/device` — **GUARDIAN** only; `{ "expoPushToken" }` for mobile push registration

Same paths under `/api/v1/guardian`.

On **visit clock-out** and **incident create**, the server notifies linked guardians (in-app `Message` threads, optional Resend email when configured, Expo push when a token exists). See `src/services/notificationService.ts`.

### Billing & payroll (MANAGER/ADMIN)

Mounted on `/api/v1/billing` and `/api/v1/payroll` (mirrored under `/api/billing` and `/api/payroll`).

**Billing**

- `GET /api/v1/billing/rate-cards` — List rate cards (`?clientId`, `?active`)
- `POST /api/v1/billing/rate-cards` — Create rate card (hourly or fixed billing; payroll and mileage fields; optional `billingModifiers` JSON)
- `PATCH /api/v1/billing/rate-cards/:id` — Update rate card
- `GET /api/v1/billing/invoices` — List invoices (`?clientId`, `?status=`)
- `POST /api/v1/billing/invoices/generate` — Build invoices from completed visits in a period
- `GET /api/v1/billing/invoices/:id` — Invoice detail
- `PATCH /api/v1/billing/invoices/:id` — Update `status` (`DRAFT` | `ISSUED` | `PAID` | `VOID`)
- `GET /api/v1/billing/invoices/:id/export/xero` — Invoice lines as CSV (Xero-oriented columns)
- `GET /api/v1/billing/invoices/:id/export/csv` — Same as Xero export

**Payroll**

- `GET /api/v1/payroll/payslips` — List payslips (`?carerId`)
- `POST /api/v1/payroll/payslips/generate` — Build payslips from completed visits in a period
- `GET /api/v1/payroll/payslips/:id` — Payslip detail
- `PATCH /api/v1/payroll/payslips/:id` — Update `status` and/or draft `expenseReimbursements`
- `PATCH /api/v1/payroll/visits/:visitId/mileage-override` — Set or clear reported miles for a visit
- `GET /api/v1/payroll/payslips/:id/export/csv` — Payslip line detail as CSV

See root `README.md`, `docs/prd/PRD-004-billing-payroll-reporting-v1.md` (as-built summary), and `API_IMPLEMENTATION.md` for full behaviour.

## Platform (audit, reporting, messaging)

Requires JWT; paths under `/api/v1` unless noted. See `API_IMPLEMENTATION.md` for request/response shapes.

### Admin (ADMIN)

- `GET /api/v1/admin/audit-logs` — org-scoped audit entries (recent window, capped list).
- `GET /api/v1/admin/reports/enterprise?from&to` — bundled operational and financial metrics (including hours, revenue, payroll costs — see `API_IMPLEMENTATION.md`).
- `GET /api/v1/admin/reports/ops/*` (+ `/export`) — same operational JSON/CSV reports as on the manager router.

### Manager (MANAGER or ADMIN)

- `POST /api/v1/manager/messages/carer/:carerId` — direct message to one carer (`body`, optional `subject`).
- `POST /api/v1/manager/messages/broadcast` — alert to all active carers in the org.
- `GET /api/v1/manager/reports/ops/*` (+ `/export`) — operational reports (missed visits, medication compliance detail, hours delivered, incidents, payroll summary); same paths as under `/api/v1/admin/reports/ops/*`.

### Compliance (MANAGER or ADMIN)

Under `/api/v1/manager/compliance`:

- `GET /dashboard` — compliance aggregates for a date range (incidents, medication compliance, missed visits, risk-style indicators).
- `GET /inspection-pack` — CSV (ZIP or single file) or PDF export of incidents, medication logs, and care plans; logs `INSPECTION_PACK_EXPORT` to `AuditLog`.

### Carer / guardian inbox

- `GET /api/v1/carer/messages/inbox` — messages addressed to the current **`CARER` or `GUARDIAN`** user.

### Server behaviour

- Successful mutating v1 requests may emit rows in `AuditLog` (middleware). Explicit `AuditLog` rows are also written for incidents, care plan changes, medication events on visits, manager messaging, and compliance inspection exports, in addition to `MedicationAuditLog` for medication rows.

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Roles

- **CARER**: Can view and manage their own visits, schedules, checklists, and notes
- **MANAGER**: Can view team data and manage clients, schedules, and templates
- **ADMIN**: Full access to all resources
- **GUARDIAN**: Read-only access to linked clients via **guardian feed** and **carer inbox** APIs (`GuardianLink` permissions apply to feed contents); cannot clock in or record medications; visit-detail carer routes that require `visit.carerId === userId` remain **carer-only**

## Database

Use Prisma Studio to view/edit data:
```bash
npm run prisma:studio
```

