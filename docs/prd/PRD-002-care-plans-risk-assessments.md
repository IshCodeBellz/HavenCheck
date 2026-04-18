# Care plans and risk assessments — as built

## Overview

Care plans are stored as **versioned structured sections** in PostgreSQL. Organisation **templates** default-seed when empty and can be extended. **Risk assessments** use org templates with weighted scoring; submissions persist answers, total score, risk level, and a **scoreBreakdown** snapshot. Review dates and reminder timestamps drive overdue and reminder listings.

## Key capabilities

- **API (`/api/v1/care-plans`):** template list/create; client plan list; create plan; patch status and review fields; new version snapshot; `POST /:carePlanId/reminders/mark-sent` (only `mark-sent` action today); review overdue and reminder list routes.
- **API (`/api/v1/risk-assessments`):** template list; client assessment list; `POST /assessments` with `answers` map and optional `carePlanId`.
- **Web:** `/admin/clients/[id]/care-plan`, `/admin/clients/[id]/risk-assessments`, `/admin/care-plans`, `/admin/risk-assessments`.
- **Mobile:** read-only **Care plan** screen fed by `GET /api/visits/:visitId/care-plan` (legacy visits router; same visit access as other visit reads).

## How it works

1. Managers or admins create or update plans from templates, publish new versions when sections change, and set review dates.
2. Risk assessments are filed from templates; the server computes and stores scores.
3. Carers on mobile open the care plan summary from visit detail to read the active plan text; they do not author plans in the app.
