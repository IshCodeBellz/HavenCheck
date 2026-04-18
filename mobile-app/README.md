# HavenCheck — mobile app

React Native (Expo) client for the HavenCheck API.

## Overview

The app authenticates against the same JWT API as the web portal. After login, **role** selects the navigator: carer/guardian (`CarerTabs`), manager (`ManagerTabs`), or admin (`AdminTabs`).

## Key capabilities

### Carer

* Today’s visits, weekly schedule, visit history  
* Visit detail: clock in/out (GPS), checklists, notes, medication due list and events (PRN and signature fields when required), link to read-only care plan summary when enabled  
* Open shifts (browse, apply, withdraw)  
* Availability windows  
* Offline queue for failed clock and medication-event requests (`src/services/offline/`)

### Guardian

* **Family feed** tab — structured cards for visits, notes, and incidents; polling; optional Expo push token registration (`expo-notifications`)  
* **Care alerts** tab — `GET /api/v1/carer/messages/inbox`  
* No carer-only tabs (rota, open shifts, history) in the guardian navigator

### Manager

* Tabs: Dashboard, Clients, Carers  
* Drawer: open shifts, schedules, visits, checklists, availability, profile (same underlying screens as much of the admin mobile surface)

### Admin

* Visible tabs: Dashboard, Clients, Carers  
* Drawer: open shifts, schedules, visits, checklists, availability (`AdminAvailabilityScreen`), profile  
* Additional stack screens (e.g. open-shift detail) as registered in `AppNavigator`

## How it works

1. Configure `EXPO_PUBLIC_API_ORIGIN` (and optional `EXPO_PUBLIC_API_PORT`) or rely on dev auto-detection — see `src/services/api.ts`.  
2. `npm install` then `npm start`.  
3. Sign in with email, password, and organisation code (seed uses **`HFL`**).

## Test credentials (seed)

| Role    | Email                 | Password  |
|---------|----------------------|-----------|
| Admin   | admin@havenflow.com  | admin123  |
| Manager | manager@havenflow.com | manager123 |
| Carer   | carer1@havenflow.com | carer123  |

## Project structure

```
src/
  ├── screens/       # carer/, guardian/, admin/, staff/, …
  ├── navigation/    # AppNavigator, CarerTabs, ManagerTabs, AdminTabs
  ├── services/      # api.ts, guardian.ts, visits, offline helpers
  ├── context/       # AuthContext
  └── components/    # Shared UI (e.g. ESignature, SignatureCapture)
```
