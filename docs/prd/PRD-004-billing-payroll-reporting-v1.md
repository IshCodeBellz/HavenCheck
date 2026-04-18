# Billing, payroll, and reporting — as built

## Overview

**Rate cards** store billing and payroll parameters. **Invoices** and **payslips** are generated from **completed visits** with clock-in/out in a chosen period. Output for finance is **CSV** download from the web admin pages or the export routes. **Reporting** covers enterprise-style JSON bundles, MAR/timesheet/medication-compliance admin endpoints, manager/admin **operational reports** under `/reports/ops/*`, and manager **compliance** dashboard plus inspection pack downloads.

## Key capabilities

- **Billing:** `/api/v1/billing/*` — rate cards CRUD; invoice list and generate; per-invoice CSV export (`export/xero` / `export/csv`).
- **Payroll:** `/api/v1/payroll/*` — payslip list and generate; per-payslip CSV export.
- **Web:** `/admin/billing`, `/admin/payroll`, `/admin/reports`, `/manager/reports`, `/manager/compliance`.
- **API:** `/api/v1/admin/reports/enterprise`, MAR/timesheet/medication-compliance routes; `/api/v1/manager/compliance/dashboard` and `.../inspection-pack`; `/api/v1/manager/reports/ops/...` and the same paths registered on the admin router — see `backend/API_IMPLEMENTATION.md`.

## How it works

1. Staff ensure visits are completed with clock events for the billing/payroll window.
2. Managers or admins create or update rate cards to match commercial rules.
3. Users run invoice or payslip generation, then download CSV from the admin UI (or call export endpoints with a JWT).
