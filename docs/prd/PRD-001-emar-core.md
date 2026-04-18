# eMAR — as built

## Overview

Client medications and schedules are configured per organisation. Carers record **MedicationEvent** rows on assigned visits (administered or omitted) with validation for PRN fields and signatures when required. Optional **MedicationStock** tracks quantity and reorder thresholds. **MedicationAlert** records support detection runs (manual from the MAR UI or optional server cron), acknowledgement, and admin listing. Audit history uses **MedicationAuditLog** alongside general platform audit patterns.

## Key capabilities

- Admin web: per-client medications and schedules; MAR page with chart data, compliance summary, exceptions, alerts list, acknowledge, and “run detection” (`/admin/mar`, `/admin/clients/[id]/medications`).
- Carer mobile (and shared visit detail patterns): due medications for the visit window; `POST /api/visits/:visitId/med-events` with omission reasons, PRN indication and dosage, effectiveness note, signature payload when enforced; offline retry queue for failed medication POSTs.
- Web visit detail: read medication history for a visit.
- APIs: legacy visit medication routes (`backend/README.md`); `GET /api/v1/emar/exceptions`; `GET /api/v1/emar/alerts`, `PATCH /api/v1/emar/alerts/:id/acknowledge`, `POST /api/v1/emar/alerts/run-detection` (**ADMIN** JWT on the `emar` router); admin MAR/chart/compliance routes under `/api/v1/admin/reports/...` as documented in `backend/API_IMPLEMENTATION.md`.

## How it works

1. Admin defines medications, optional stock row, and schedules for each client.
2. On a visit, the carer records each dose outcome; the server validates, writes events and audit rows, and updates stock when a stock row exists.
3. Detection creates or updates **MedicationAlert** rows and can notify staff via the messaging layer; admins review and acknowledge from the MAR UI.
4. Compliance and MAR exports use admin report endpoints for CSV/JSON as implemented.
