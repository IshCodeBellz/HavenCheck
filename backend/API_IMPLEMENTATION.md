# API v1 Implementation Summary

This document lists **implemented** REST endpoints under `/api/v1` that exist in the HavenCheck backend today. Legacy `/api` routes used by the mobile app and parts of the web UI are summarised in `backend/README.md`. Narrative product behaviour: **`docs/CAPABILITIES.md`**.

## Scope

v1 covers authentication, carer and manager operational routes, admin org data, eMAR reporting, structured care plans and risk assessments, incidents and guardian feed, manager compliance (dashboard and inspection exports), billing and payroll, organisation audit logging, and reporting endpoints consumed by the web portal. Some mobile flows still call legacy `/api/visits` for visits and medication events.

## Base URL
All endpoints are available under `/api/v1`

## Authentication
All authenticated endpoints require: `Authorization: Bearer <jwt>`

## Error Response Format
All errors follow the consistent format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

Error codes:
- `UNAUTHORIZED` - Authentication required or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `INTERNAL_ERROR` - Server error

## Endpoints

### 7.1 Auth

#### POST /api/v1/auth/login
- **Body**: `{ "email": "carer@example.com", "organizationCode": "HFL", "password": "Password123!" }` (`organizationCode` must match the user’s org; seed uses `HFL`)
- **Response**: `{ "token": "<jwt>", "user": { "id", "name", "email", "role", "companyName", "organizationCode" } }`

#### GET /api/v1/auth/me
- **Response**: Current user information

#### POST /api/v1/auth/register / POST /api/v1/auth/organizations
- Registration and organisation creation (see `auth.ts` for bodies and rate limits).

#### POST /api/v1/auth/verify-email / POST /api/v1/auth/resend-verification
- Email verification flows.

#### POST /api/v1/auth/change-password
- Authenticated; body: `currentPassword`, `newPassword`.

### 7.2 Carer routes (`/api/v1/carer/*`)

Router-level roles: **`CARER` or `GUARDIAN`** (guardians may call read-only paths where authorised; clock-in/out and applications require **`CARER`** inside the handler).

#### GET /api/v1/carer/visits/today
- Today’s visits for the authenticated carer.

#### GET /api/v1/carer/visits
- Visit list for the carer; supports the same query-style filtering as implemented in `visitsService.getVisits` (e.g. date range via query params passed through).

#### GET /api/v1/carer/visits/:visitId
- Visit details; enforces `visit.carerId === req.userId`.

#### POST /api/v1/carer/visits/:visitId/clock-in
- Body: `{ "latitude": number, "longitude": number, "lateClockInReason"?: string }` — **`CARER` only**.

#### POST /api/v1/carer/visits/:visitId/clock-out
- Body: `{ "latitude": number, "longitude": number }` — **`CARER` only**.

#### GET /api/v1/carer/schedules/weekly?weekStart=YYYY-MM-DD
- Weekly rota payload for the carer (schedules service).

#### GET /api/v1/carer/schedules
- List schedules for the carer (query params as implemented).

#### Open shifts (carer)
- `GET /api/v1/carer/open-shifts` — available postings (**`CARER`** usage expected).
- `POST /api/v1/carer/open-shifts/:shiftPostingId/apply` — **`CARER` only**.
- `POST /api/v1/carer/open-shifts/applications/:applicationId/withdraw` — **`CARER` only**.

#### Checklists
- `GET /api/v1/carer/checklists/templates?clientId=` — templates for a client (or default when omitted).
- `POST /api/v1/carer/checklists/visits/:visitId/submit` — submit checklist JSON body.
- `GET /api/v1/carer/checklists/visits/:visitId/submissions` — list submissions for the visit.

#### Notes
- `GET /api/v1/carer/notes/visits/:visitId` — notes on the visit (`?type=` optional).
- `GET /api/v1/carer/notes/visits/:visitId/handover` — handover-type notes for the visit.
- `POST /api/v1/carer/notes` — create note; body includes `visitId` and fields validated in `notesService.createNote`.

#### Availability
- `GET /api/v1/carer/availability`, `POST /api/v1/carer/availability`, `PUT /api/v1/carer/availability/:id`, `DELETE /api/v1/carer/availability/:id` — carer’s own availability windows.

#### GET /api/v1/carer/messages/inbox
- In-app messages for the authenticated **`CARER` or `GUARDIAN`** (organisation-scoped). Guardians receive visit-complete and incident alert threads here in addition to the guardian feed.

### 7.3 Manager Endpoints

All manager endpoints require MANAGER or ADMIN role.

#### GET /api/v1/manager/overview/today
- Returns:
  - Active carers (currently clocked in)
  - Today's visits summary (per status)

#### GET /api/v1/manager/team-rota/week?start=YYYY-MM-DD
- Returns weekly rota for all carers in manager's scope (MVP: all carers)
- Response includes carers with their scheduled entries grouped per day

#### GET /api/v1/manager/team-rota/suggestions/:scheduleId
- Returns ranked carer candidates for the slot
- Combines: no overlapping schedule (availability proxy), DBS + certification eligibility vs client requirements, preference boost when `preferredClientIds` contains the client

#### PATCH /api/v1/manager/team-rota/reassign/:id
- `:id` is the **schedule** id. Body: `{ "carerId": "<userId>" }` (same carer allowed as no-op)
- Validates org scope, carer role, availability window, skills matrix, and **no time overlap** with other schedules for that carer
- Refreshes optional travel fields when prior visit and client coordinates exist
- Errors: `400` with `VALIDATION_ERROR` / codes such as `CONFLICT`, `SKILL_MISMATCH_DBS`, `SKILL_MISMATCH_CERTIFICATION`

#### Messaging (MANAGER or ADMIN)

- `POST /api/v1/manager/messages/carer/:carerId` — Body: `{ "body": string, "subject"?: string }`; creates a thread and first message to that carer.
- `POST /api/v1/manager/messages/broadcast` — Same body; creates a thread and one message per active carer in the organisation (operational alerts).

#### Compliance (MANAGER or ADMIN)

Mounted under `/api/v1/manager/compliance` (same auth stack as other manager routes).

- `GET /api/v1/manager/compliance/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` — Aggregates for the signed-in user’s organisation: incidents (in-range and open counts, severity/status breakdown, recent rows), medication administered vs omitted and compliance rate, missed/incomplete/late visits whose `scheduledStart` falls in the range, and risk-style counts (unacknowledged medication alerts in range, HIGH risk assessments in range, active care plans past `reviewDate`). If `from` is omitted, the range defaults to the last 30 days ending at `to` (or today).
- `GET /api/v1/manager/compliance/inspection-pack?from&to&format=csv|pdf&include=...` — Download pack for regulators. **`format=csv`:** with multiple `include` sections (`incidents`, `medications`, `care_plans`, comma-separated; `all` or omit for all three), response is `application/zip` with one CSV per section; with exactly one section, response is a single UTF-8 CSV (`text/csv`). **`format=pdf`:** one PDF document with incidents, medication logs, and care plan content (very large histories are truncated per section). Successful generation writes `AuditLog` (`INSPECTION_PACK_EXPORT`).

### 7.4 Admin Endpoints

All admin endpoints require ADMIN role.

#### Clients
- `GET /api/v1/admin/clients` - List all clients
- `GET /api/v1/admin/clients/:id` - Get client by ID
- `POST /api/v1/admin/clients` - Create client
- `PATCH /api/v1/admin/clients/:id` - Update client
- `DELETE /api/v1/admin/clients/:id` - Delete client (soft delete)

#### Carers
- `GET /api/v1/admin/carers` - List all carers
- `GET /api/v1/admin/carers/:id` - Get carer by ID
- `POST /api/v1/admin/carers` - Create carer
- `PATCH /api/v1/admin/carers/:id` - Update carer

#### Schedules
- `GET /api/v1/admin/schedules` - List schedules (with filters)
- `GET /api/v1/admin/schedules/:id` - Get schedule by ID
- `POST /api/v1/admin/schedules` - Create schedule (also creates visit)
- `PATCH /api/v1/admin/schedules/:id` - Update schedule
- `DELETE /api/v1/admin/schedules/:id` - Delete schedule

#### Visits
- `GET /api/v1/admin/visits` - List visits (with filters)
- `GET /api/v1/admin/visits/:id` - Get visit by ID
- `GET /api/v1/admin/clients/:clientId/visits?from&to` - Get client visit history

#### Reports
- `GET /api/v1/admin/reports/timesheets?from&to&carerId&clientId` - Timesheet report (org-scoped via admin JWT; completed visits with clock in/out in range)
  - Returns per-visit minutes and aggregates per carer and per client
- `GET /api/v1/admin/reports/mar-chart?from&to&clientId&status` - Medication events (MAR) for the org
- `GET /api/v1/admin/reports/mar-chart/export` - Same filters; CSV download
- `GET /api/v1/admin/reports/medication-compliance?from&to&clientId` - Administered vs omitted aggregates (summary used by the MAR page)
- `GET /api/v1/admin/reports/enterprise?from&to` - JSON `reports` array: missed/completed/late visits, medication counts and compliance rate, **hours_delivered** and **total_hours**, **revenue** (sum of `ISSUED`+`PAID` invoice totals for billing periods overlapping the filter window), **payroll_costs** (sum of payslip `netPayTotal` over overlapping pay periods), incident count, active clients, visit completion rate; used by `/admin/reports` (`reportingService.getEnterpriseReports`)

#### Operational reports (`/reports/ops/*`, MANAGER or ADMIN)

Registered on both **`/api/v1/manager`** and **`/api/v1/admin`**. Replace `<prefix>` with `manager` or `admin`.

| JSON | CSV export |
|------|------------|
| `GET /api/v1/<prefix>/reports/ops/missed-visits` | `.../missed-visits/export` |
| `GET /api/v1/<prefix>/reports/ops/medication-compliance` | `.../medication-compliance/export` |
| `GET /api/v1/<prefix>/reports/ops/hours-delivered` | `.../hours-delivered/export` |
| `GET /api/v1/<prefix>/reports/ops/incidents` | `.../incidents/export` |
| `GET /api/v1/<prefix>/reports/ops/payroll-summary` | `.../payroll-summary/export` |

Shared query parameters (where applicable): `from`, `to`, `clientId`, `carerId`; incidents JSON/CSV also accept `severity` and `status`.

Web UI: **`/manager/reports`**.

#### Audit (admin)

- `GET /api/v1/admin/audit-logs` - Organisation-scoped audit log stream (recent entries; suitable for compliance review alongside eMAR `MedicationAuditLog`).

#### eMAR (admin)
- `GET /api/v1/emar/exceptions?from&to&clientId` — Omitted medication events with summary counts (missed / refused / late heuristics from `reasonCode` text).
- `GET /api/v1/emar/alerts?includeAcknowledged=0|1&limit=` — Medication alerts (missed, late, PRN misuse, low stock) for the organisation.
- `PATCH /api/v1/emar/alerts/:alertId/acknowledge` — Acknowledge one alert.
- `POST /api/v1/emar/alerts/run-detection` — Run detection rules once for the organisation (same logic as optional cron when `ENABLE_MED_ALERT_CRON=1` on the server).

#### Care plans (`MANAGER` or `ADMIN` for all routes in this group)

- `GET /api/v1/care-plans/templates` — List org care plan templates (auto-seeded defaults when empty).
- `POST /api/v1/care-plans/templates` — Create org template (`key`, `name`, optional `description`, `sections[]`).
- `GET /api/v1/care-plans/client/:clientId` — List plans for a client (includes current version + sections).
- `GET /api/v1/care-plans/reviews/overdue` — Active plans with `reviewDate` in the past.
- `GET /api/v1/care-plans/reviews/reminders` — Active plans whose `reviewReminderAt` is due and reminder not marked sent (see route logic).
- `POST /api/v1/care-plans` — Create plan + version 1 (body: `clientId`, `sections[]`, optional `status`, `reviewDate`, `reviewReminderAt`, `summary`).
- `PATCH /api/v1/care-plans/:carePlanId` — Update `status`, `reviewDate`, `reviewReminderAt`.
- `POST /api/v1/care-plans/:carePlanId/versions` — New version (snapshot `sections[]`, optional `summary`).
- `POST /api/v1/care-plans/:carePlanId/reminders/mark-sent` — Sets `reviewReminderSentAt` to now.

**Carer read path (legacy router, not v1):** `GET /api/visits/:visitId/care-plan` — active structured care plan for the visit’s client; same visit access rules as `GET /api/visits/:visitId`.

#### Risk assessments (`MANAGER` or `ADMIN` for all routes in this group)

- `GET /api/v1/risk-assessments/templates` — List org risk templates (auto-seeded: falls, pressure sores, nutrition).
- `GET /api/v1/risk-assessments/client/:clientId` — List assessments; each response item includes `totalScore`, optional `maxScore`, `riskLevel`, and `scoreBreakdown` (`{ maxScore, lines[] }`, persisted on create).
- `POST /api/v1/risk-assessments/assessments` — Create assessment (`clientId`, `templateId`, `answers` 0–3 per rule key, optional `carePlanId`, optional `reviewedAt`).

**Note:** Carers record medication events via **`POST /api/visits/:visitId/med-events`** (legacy). Admin eMAR configuration uses `/api/v1/admin/...` as documented in the Admin and `backend/README.md` sections.

### Billing & payroll (MANAGER or ADMIN)

Mounted on `/api/v1/billing` and `/api/v1/payroll` (mirrored on `/api/billing` and `/api/payroll`).

#### Billing

- `GET /api/v1/billing/rate-cards` — List (`?clientId`, `?active`)
- `POST /api/v1/billing/rate-cards` — Create (`billingRateType` HOURLY or FIXED; matching rate fields; `payrollHourlyRate`; optional `mileageRatePerMile`, `holidayAccrualRate`, `contractRef`, `clientId`, `billingModifiers` JSON e.g. `{ "weekendHourlyMultiplier": 1.25 }` applied to Sat/Sun UTC on generated lines)
- `PATCH /api/v1/billing/rate-cards/:id` — Partial update
- `GET /api/v1/billing/invoices` — List (`?clientId`, optional `?status=`)
- `POST /api/v1/billing/invoices/generate` — From completed visits: body `periodStart`, `periodEnd` (ISO), optional `clientId`, `rateCardId`, `contractRef`, `dueDays`, `currency`
- `GET /api/v1/billing/invoices/:id` — Invoice detail (includes `lineItems`)
- `PATCH /api/v1/billing/invoices/:id` — Body `{ "status": "DRAFT" | "ISSUED" | "PAID" | "VOID" }` with validated transitions
- `GET /api/v1/billing/invoices/:id/export/xero` — CSV download
- `GET /api/v1/billing/invoices/:id/export/csv` — Same CSV as Xero export

#### Payroll

- `GET /api/v1/payroll/payslips` — List (`?carerId`)
- `POST /api/v1/payroll/payslips/generate` — From completed visits: body `periodStart`, `periodEnd`, optional `carerId`, `rateCardId` (shared `resolveRateCard` with billing)
- `GET /api/v1/payroll/payslips/:id` — Payslip detail (`lineItems` include `mileageSource`)
- `PATCH /api/v1/payroll/payslips/:id` — Optional `status`; optional `expenseReimbursements` while `DRAFT`; recomputes `netPayTotal`
- `PATCH /api/v1/payroll/visits/:visitId/mileage-override` — Body `{ mileageMilesOverride: number | null }`
- `GET /api/v1/payroll/payslips/:id/export/csv` — CSV download

### Incidents & guardian (CARER/MANAGER/ADMIN for writes; GUARDIAN for feed only)

Mounted on `/api/v1` and mirrored on legacy `/api` (same paths after the prefix).

#### Incidents
- `POST /api/v1/incidents` — Create incident (`clientId`, `category`, `severity`, `safeguardingFlag`, optional `visitId`, `details`)
- `GET /api/v1/incidents` — List (`?clientId`, `?status`)
- `POST /api/v1/incidents/:incidentId/escalate` — MANAGER/ADMIN (`reason`, optional `slaDueAt`)
- `POST /api/v1/incidents/:incidentId/follow-ups` — Add follow-up (`note`, optional `dueAt`, `done`)
- `POST /api/v1/incidents/:incidentId/actions` — Add action (`description`, optional `ownerUserId`, `dueAt`, `status`)
- `POST /api/v1/incidents/body-maps` — Body map entry (`clientId`, `coordinates[]`, optional `incidentId`, `notes`, `images[]`)
- `GET /api/v1/incidents/clients/:clientId/body-maps` — Timeline for client

#### Guardian
- `POST /api/v1/guardian/invite` — MANAGER/ADMIN: link `guardianUserId` to `clientId`; flags `readOnly`, `canViewVisits`, `canViewNotes`, `canViewIncidents`
- `GET /api/v1/guardian/feed` — GUARDIAN only; optional `?clientId`, `?since` (ISO); structured feed items (`headline`, `client`, nested `visit` / `note` / `incident`)
- `POST /api/v1/guardian/device` — GUARDIAN only; body `{ "expoPushToken": string }` for Expo mobile push (stored on `User`)

## Implementation Notes

1. **Weekly rota (carer):** Implemented as `GET /api/v1/carer/schedules/weekly` (schedules service merges schedule and visit data as implemented in code).

2. **Checklists:** Template resolution uses `GET /api/v1/carer/checklists/templates?clientId=` (client-specific template when configured, otherwise default).

3. **Checklist validation:** Submit endpoint validates required checklist items before persisting.

4. **Handover notes:** `GET /api/v1/carer/notes/visits/:visitId/handover` returns handover notes for that visit (not a separate “latest per client” URL).

5. **Role enforcement:** Each router applies `authenticate` and `requireRole` (or inline checks) as coded in `src/routes/*.ts`. Billing, payroll, care plans, and risk template/list routes require **`MANAGER` or `ADMIN`** where stated above.

6. **Errors:** JSON body `{ "error": "CODE", "message": "..." }` on failures.

7. **Legacy `/api`:** Still used by the mobile app for visits and several web flows; v1 is preferred for new integrations.

8. **Platform audit:** Successful mutating `/api/v1/*` requests may write `AuditLog` (see middleware in `src/index.ts`). Additional explicit `AuditLog` rows are written for incident actions, care plan mutations, medication events (and related blocks/deletes) on visits, manager messaging, and compliance inspection-pack downloads. Medication row history also uses `MedicationAuditLog`.

## File Structure

- `src/routes/auth.ts` - Authentication endpoints
- `src/routes/carer.ts` - Carer-specific endpoints
- `src/routes/manager.ts` - Manager-specific endpoints (includes `compliance` sub-router)
- `src/routes/compliance.ts` - Manager compliance dashboard and inspection-pack downloads
- `src/services/complianceService.ts` - Compliance aggregates and export builders
- `src/routes/admin.ts` - Admin endpoints
- `src/routes/emar.ts` - eMAR exceptions and medication alerts
- `src/services/medicationAlertDetectionService.ts` - Alert rule evaluation (cron + manual)
- `src/services/medicationAlertService.ts` - Alert persistence and acknowledgement helpers
- `src/routes/carePlans.ts` - Structured care plans and review helpers
- `src/routes/risk.ts` - Risk templates and assessments
- `src/routes/incidents.ts` - Incidents, escalations, follow-ups, actions, body maps
- `src/routes/guardian.ts` - Guardian invite and read-only feed
- `src/routes/billing.ts` - Rate cards, invoices, invoice CSV export
- `src/routes/payroll.ts` - Payslips, payslip CSV export
- `src/services/auditLogService.ts` - Organisation audit log writes
- `src/services/reportingService.ts` - Bundled enterprise reporting queries
- `src/routes/orgReporting.ts` - `registerOrgReportingRoutes` (manager/admin ops reports)
- `src/services/notificationService.ts` - Manager→carer and broadcast messaging; guardian visit/incident notifications (email, Expo push, in-app)
- `src/middleware/auth.ts` - Authentication and authorization middleware
- `src/index.ts` - Main server file with route registration

