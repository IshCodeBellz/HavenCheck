# API v1 Implementation Summary

This document summarizes the REST API v1 implementation according to the MVP specification.

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
- **Body**: `{ "email": "carer@example.com", "password": "Password123!" }`
- **Response**: `{ "token": "<jwt>", "user": { "id", "name", "email", "role" } }`

#### GET /api/v1/auth/me
- **Response**: Current user information

### 7.2 Carer Endpoints

All carer endpoints require CARER role.

#### GET /api/v1/carer/visits/today
- Returns visits assigned to current carer for today

#### GET /api/v1/carer/rota/week?start=YYYY-MM-DD
- Returns weekly rota for the carer
- `start` is the Monday (or any week start) date in ISO format
- Response includes visits/schedules grouped by day

#### GET /api/v1/carer/visits/:visitId
- Get visit details

#### POST /api/v1/carer/visits/:visitId/clock-in
- Clock in for a visit
- Body: `{ "latitude": number, "longitude": number }`

#### POST /api/v1/carer/visits/:visitId/clock-out
- Clock out for a visit
- Body: `{ "latitude": number, "longitude": number }`

#### GET /api/v1/carer/visits/:visitId/checklist-template
- Get checklist template for the visit (client-specific or default)

#### POST /api/v1/carer/visits/:visitId/checklist-submissions
- Submit checklist for a visit
- Validates required items

#### POST /api/v1/carer/visits/:visitId/notes
- Add a note to a visit
- Body: `{ "type": "GENERAL" | "INCIDENT" | "HANDOVER", "priority": "NORMAL" | "HIGH", "text": string }`

#### GET /api/v1/carer/clients/:clientId/handover/latest
- Get the most recent HANDOVER note for a client

#### GET /api/v1/carer/visits/history?from&to
- Get visit history with optional date range

### 7.3 Manager Endpoints

All manager endpoints require MANAGER or ADMIN role.

#### GET /api/v1/manager/overview/today
- Returns:
  - Active carers (currently clocked in)
  - Today's visits summary (per status)

#### GET /api/v1/manager/team-rota/week?start=YYYY-MM-DD
- Returns weekly rota for all carers in manager's scope (MVP: all carers)
- Response includes carers with their scheduled entries grouped per day

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
- `GET /api/v1/admin/reports/timesheets?from&to&carerId` - Get timesheet report
  - Returns total time per visit, aggregated per carer
  - Based on clockInTime and clockOutTime

## Implementation Notes

1. **Weekly Rota Logic**: The `/carer/rota/week` endpoint combines both Schedule and Visit records. Visits take precedence when they exist, but schedules are also shown.

2. **Checklist Template**: The `/carer/visits/:visitId/checklist-template` endpoint first looks for a client-specific template, then falls back to a default template (no clientId).

3. **Checklist Validation**: The checklist submission endpoint validates that all required items are provided before creating the submission.

4. **Handover Notes**: Handover notes (type: HANDOVER) are accessible via the `/carer/clients/:clientId/handover/latest` endpoint.

5. **Role Enforcement**: All endpoints enforce role-based access control:
   - Carer endpoints: CARER role only
   - Manager endpoints: MANAGER or ADMIN role
   - Admin endpoints: ADMIN role only

6. **Error Handling**: All endpoints use consistent error response format with error codes and messages.

7. **Backward Compatibility**: Legacy routes (`/api/*`) are still available but will be deprecated in favor of `/api/v1/*` routes.

## File Structure

- `src/routes/auth.ts` - Authentication endpoints
- `src/routes/carer.ts` - Carer-specific endpoints
- `src/routes/manager.ts` - Manager-specific endpoints
- `src/routes/admin.ts` - Admin endpoints
- `src/middleware/auth.ts` - Authentication and authorization middleware
- `src/index.ts` - Main server file with route registration

