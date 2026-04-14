# Haven Flow Carer App – Full Specification (MVP)

> Suggested file name: `HAVENFLOW_CARER_APP_SPEC.md`  

> Purpose: Hand this to Cursor/Copilot as the primary reference to start building the backend, mobile app, and web portal.

---

## 1. Product Overview

### 1.1 Concept

**Product name (working):** Haven Flow Carer App

A mobile + web system for Haven Flow care staff to:

- Clock in/out at **specific client locations** (with GPS capture, later geofencing).

- Record **care checklists** at custom intervals (e.g., "every 4 hours") for:

  - Food / hydration.

  - Medication.

  - Personal care.

  - Mood/wellbeing.

- Maintain an **auditable paperwork trail** per client for compliance (e.g., CQC).

- Provide **shift handover** between day/night teams and across shifts.

- Manage **rotas** so carers know their shifts and managers can see coverage.

- Give managers/admins **mobile and web** access for oversight and configuration.

### 1.2 Platforms

- **Carer / Manager / Admin App (mobile):**  

  - React Native (Expo) – iOS & Android.  

  - Role-based UI:

    - CARER: visits, weekly rota, checklists, notes, handover.

    - MANAGER: own rota + team overview (visits, rotas).

    - ADMIN: light management views (read-most, edit some) in MVP, full config mainly in web portal.

- **Manager/Admin Portal (web):**  

  - Next.js + TypeScript + Tailwind.  

  - Richer management screens: clients, carers, schedules, reports.

- **Backend:** Node.js (TypeScript), REST API, PostgreSQL with Prisma.

---

## 2. Roles & Personas

### 2.1 Carer / Support Worker

- Uses **mobile app** primarily.

- Key needs:

  - Simple UI (big buttons, minimal typing).

  - See **today's visits**.

  - See their **weekly rota**.

  - Clock in/out easily.

  - Complete checklists (meds, meals, etc.).

  - Add notes & shift handover.

### 2.2 Manager / Team Leader

- Uses **mobile app** and **web portal**.

- On mobile:

  - See own rota.

  - See who in their team is clocked in.

  - See daily and weekly rota of their team (read-only in MVP).

- On web:

  - Live view of who is clocked in.

  - Approve/review visits and notes.

  - Manage rotas (schedule entries).

  - Export timesheets & client logs.

### 2.3 Admin / Service Owner

- Uses **web portal** (primary) and app (light views).

- Key needs:

  - Configure clients/locations.

  - Manage carers and roles.

  - Configure geofence radius & checklist templates.

  - Manage organisation-wide settings.

---

## 3. Key User Journeys

### 3.1 Carer Daily & Weekly Flow

1. Open app, log in.

2. Land on **Today's Visits**.

3. Switch to **Weekly Rota** tab to see all shifts for the current week.

4. Tap a day → see visits/shifts for that day.

5. Tap a visit → **Visit Detail**.

6. On arrival: tap **Clock In** (GPS captured).

7. During shift:

   - At required intervals, open **Checklist** and submit.

   - Add notes/incidents if needed.

8. Before leaving: tap **Clock Out**.

9. Add **handover note** for the next shift if required.

### 3.2 Manager Mobile Flow

1. Open app, log in as `MANAGER`.

2. See **Today Overview**:

   - Carers currently clocked in.

   - Visits in progress.

3. Switch to **Team Rota (Weekly)**:

   - Weekly view of which carers are assigned where.

4. Tap a carer → see that carer's weekly rota.

5. Tap a visit → read-only visit details (for MVP).

### 3.3 Manager/Admin Web Flow

1. Log into web portal.

2. See **Dashboard**:

   - Active carers, visits in progress, missed visits.

3. Manage:

   - **Clients**: CRUD, geofences, templates.

   - **Carers**: CRUD, assign roles.

   - **Schedules/Rotas**: assign carers to clients.

4. View visits and notes.

5. Export timesheets and reports.

### 3.4 Admin Setup Flow (Web, mainly)

1. Create new **Client** (name, address, geofence, contact info).

2. Set **Checklist Template** for that client.

3. Create **Carer** accounts.

4. Create **Schedule** entries linking carers to clients for time ranges.

5. (Optional) Later set repeating rotas.

---

## 4. Functional Requirements (High-Level)

### 4.1 Authentication & Roles

- Login with email + password (JWT-based).

- Roles: `CARER`, `MANAGER`, `ADMIN`.

- Role-based access on backend.

- Frontend (mobile + web) shows different navigation/layout per role.

### 4.2 Mobile App – Common Shell

- Common login screen for all roles.

- Once logged in:

  - Navigation is role-aware.

  - Role is included in `/me` response.

#### Navigation examples

- **CARER:**

  - Tabs or bottom nav:

    - Today

    - Weekly Rota

    - History

    - Settings

- **MANAGER:**

  - Tabs:

    - Today Overview

    - Team Rota (Weekly)

    - Clients (optional read-only)

    - Settings

- **ADMIN (in app, MVP):**

  - Focus on overview + read-only:

    - Today Overview

    - Team Rota

    - Clients (read-only)

    - Settings

---

### 4.3 Carer Mobile Screens

#### 1. Login

- Inputs: Email, Password.

- Button: **Log In**.

#### 2. Today's Visits

- List of visits for today:

  - Client name & address.

  - Scheduled time window.

  - Status pill (Not Started / In Progress / Completed).

- Tap → Visit Detail.

#### 3. Weekly Rota (NEW)

- Default view: current week (Mon–Sun).

- For each day:

  - Show list of scheduled shifts / visits (start & end time, client name).

- UX idea:

  - Horizontal day strip (Mon–Sun) at top, list below for selected day.

- Carer can:

  - Swipe left/right to previous/next week.

- Data source: `Schedule` + generated `Visit`s.

#### 4. Visit Detail

- Shows:

  - Client name, address, map thumbnail.

  - Scheduled start/end.

  - Status, clock-in/out times (if any).

- Buttons:

  - **Clock In** ↔ **Clock Out** (depending on status).

  - "Open Checklist".

  - "Notes & Handover".

#### 5. Checklist

- Pulls template via API.

- Renders list of controls based on `type`.

- Save completes one "submission" (interval).

- Shows success toast.

#### 6. Notes & Handover

- Tabs:

  - **Notes** – general & incident.

  - **Handover** – read latest + add new.

- "Add Note" button:

  - Select type (GENERAL / INCIDENT / HANDOVER).

  - Priority (NORMAL/HIGH).

  - Text area.

#### 7. History

- List of past visits (last 30 days).

- Filter by date.

- Tap → view details & submissions (read-only).

#### 8. Settings

- Profile info.

- (Optionally) change password.

- Log out.

---

### 4.4 Manager Mobile Screens

#### 1. Today Overview

- Section: **Active Carers**

  - Each: Carer name, client, since when clocked in.

- Section: **Visits Today**

  - Grouped by status (Not Started, In Progress, Completed, Missed).

- Tap carer/visit for more details (read-only).

#### 2. Team Weekly Rota

- Weekly calendar-style view.

- For each day:

  - Carer rows, with blocks representing scheduled shifts for each client.

- Tap carer row:

  - View that carer's weekly rota (similar to carer view, but read-only).

- MVP: READ-ONLY rota (no editing in app).

---

### 4.5 Web Portal (Manager/Admin)

Same as before:

- Login.

- Dashboard.

- Clients CRUD.

- Carers CRUD.

- Schedules/Rotas creation.

- Visits listing.

- Reports (timesheets etc).

---

## 5. Architecture

Same as previous spec:

- React Native (Expo) app.

- Next.js admin portal.

- Node.js REST API with Prisma + PostgreSQL.

- JWT auth.

- Shared API for web and mobile.

---

## 6. Data Model (Prisma Schema)

> Same as before; already rota-aware through `Schedule`.  

> No change needed for adding manager views or weekly rota, we'll use `Schedule` + `Visit`.

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  CARER
  MANAGER
  ADMIN
}

enum VisitStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  MISSED
}

enum NoteType {
  GENERAL
  INCIDENT
  HANDOVER
}

enum NotePriority {
  NORMAL
  HIGH
}

enum ChecklistFieldType {
  BOOLEAN
  TEXT
  NUMBER
  SELECT
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  phone        String?  @unique
  passwordHash String
  role         UserRole @default(CARER)
  isActive     Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  visits    Visit[]    @relation("CarerVisits")
  notes     Note[]     @relation("UserNotes")
  schedules Schedule[] @relation("UserSchedules")
}

model Client {
  id        String   @id @default(cuid())
  name      String
  address   String
  latitude  Float?
  longitude Float?
  geofenceRadiusMeters Int?

  contactName  String?
  contactPhone String?
  notes        String?

  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  visits    Visit[]
  schedules Schedule[]
  templates ChecklistTemplate[]
}

model ChecklistTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?

  clientId    String?
  client      Client?  @relation(fields: [clientId], references: [id])

  items       ChecklistItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ChecklistItem {
  id          String             @id @default(cuid())
  templateId  String
  template    ChecklistTemplate  @relation(fields: [templateId], references: [id])

  label       String
  type        ChecklistFieldType
  required    Boolean            @default(false)

  optionsJson String?
}

model Visit {
  id             String       @id @default(cuid())
  clientId       String
  client         Client       @relation(fields: [clientId], references: [id])

  carerId        String
  carer          User         @relation("CarerVisits", fields: [carerId], references: [id])

  scheduledStart DateTime?
  scheduledEnd   DateTime?

  clockInTime    DateTime?
  clockOutTime   DateTime?

  clockInLat     Float?
  clockInLng     Float?
  clockOutLat    Float?
  clockOutLng    Float?

  withinGeofence Boolean?

  status         VisitStatus  @default(NOT_STARTED)

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  checklistSubmissions VisitChecklistSubmission[]
  notes               Note[]
}

model VisitChecklistSubmission {
  id          String   @id @default(cuid())
  visitId     String
  visit       Visit    @relation(fields: [visitId], references: [id])

  templateId  String?
  template    ChecklistTemplate? @relation(fields: [templateId], references: [id])

  submittedAt DateTime @default(now())
  intervalIndex Int?

  items       VisitChecklistItem[]
}

model VisitChecklistItem {
  id                 String   @id @default(cuid())
  submissionId       String
  submission         VisitChecklistSubmission @relation(fields: [submissionId], references: [id])

  checklistItemId    String?
  checklistItem      ChecklistItem? @relation(fields: [checklistItemId], references: [id])

  valueBoolean       Boolean?
  valueText          String?
  valueNumber        Float?
  valueOption        String?
}

model Note {
  id        String       @id @default(cuid())
  visitId   String
  visit     Visit        @relation(fields: [visitId], references: [id])

  authorId  String
  author    User         @relation("UserNotes", fields: [authorId], references: [id])

  type      NoteType     @default(GENERAL)
  priority  NotePriority @default(NORMAL)
  text      String

  createdAt DateTime     @default(now())
}

model Schedule {
  id        String   @id @default(cuid())

  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])

  carerId   String
  carer     User     @relation("UserSchedules", fields: [carerId], references: [id])

  startTime DateTime
  endTime   DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

