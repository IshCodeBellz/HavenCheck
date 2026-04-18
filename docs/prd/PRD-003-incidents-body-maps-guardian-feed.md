# Incidents, body maps, and guardian — as built

## Overview

**Incidents** capture category, severity, safeguarding flag, optional visit link, and narrative. **Escalations**, **follow-ups**, and **actions** are first-class API operations. **Body map entries** store client-scoped coordinate arrays plus notes and optional image URLs. **Guardians** are linked to clients with visibility flags and read merged **feed** data plus **inbox** messages for operational alerts.

## Key capabilities

- **Incidents API:** `POST`/`GET /api/v1/incidents`; `POST .../:id/escalate`; `POST .../:id/follow-ups`; `POST .../:id/actions` (mirrored under `/api/incidents`).
- **Body maps API:** `POST /api/v1/incidents/body-maps`; `GET /api/v1/incidents/clients/:clientId/body-maps`.
- **Guardian API:** `POST /api/v1/guardian/invite`; `GET /api/v1/guardian/feed`; `POST /api/v1/guardian/device` (Expo push token on user).
- **Web staff:** `/incidents` — create incident, list, interactive body map capture and submit (uses legacy `/api/incidents` paths from the portal client).
- **Web guardian:** `/guardian` feed; `/messages` inbox; admin guardian linking `/admin/guardians`.
- **Mobile guardian:** feed and care alerts tabs using feed and inbox APIs.

## How it works

1. Staff create incidents and optional body map entries in the web incidents workspace.
2. Managers or admins use HTTP APIs for escalation, follow-ups, and actions when those steps are needed (the incidents page does not expose every workflow button today).
3. Admins invite guardian users and set `GuardianLink` visibility flags.
4. Guardians authenticate and pull `GET /api/v1/guardian/feed` plus inbox messages created by notification rules.
