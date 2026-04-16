# Haven Flow Mobile App

React Native mobile app built with Expo for Haven Flow care staff.

## Features

- **Role-based authentication** (Carer, Manager, Admin)
- **Today's visits** - View and manage daily visits
- **Weekly rota** - View scheduled shifts for the week
- **Clock in/out** - GPS-enabled clock in/out at client locations
- **Care checklists** - Complete care checklists during visits
- **Notes & handover** - Add notes and handover information
- **Visit history** - View past visits

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

Create `.env` (or `.env.local`) in `mobile-app/`:
```bash
# Optional: explicit API origin. If omitted in dev, the app auto-detects Expo host IP.
EXPO_PUBLIC_API_ORIGIN=http://localhost:3001

# Optional: custom dev backend port when host auto-detection is used
EXPO_PUBLIC_API_PORT=3001
```

The app builds API URLs from origin + route prefixes:
- Legacy API: `${API_ORIGIN}/api`
- v1 API: `${API_ORIGIN}/api/v1`

3. Start the development server:
```bash
npm start
```

4. Run on iOS/Android:
```bash
npm run ios
# or
npm run android
```

## Project Structure

```
src/
  ├── screens/          # Screen components
  │   ├── carer/       # Carer-specific screens
  │   ├── manager/     # Manager-specific screens
  │   └── ...
  ├── navigation/      # Navigation configuration
  ├── services/        # API service functions
  ├── context/         # React context providers
  ├── types/           # TypeScript type definitions
  └── components/      # Reusable components
```

## Environment Variables

API origin resolution order:
1. `EXPO_PUBLIC_API_ORIGIN` (if set)
2. Production fallback when `__DEV__` is false (`https://api.havenflow.com`)
3. In development, Expo host auto-detection + `EXPO_PUBLIC_API_PORT` (defaults to `3001`)
4. Final fallback: `http://localhost:3001`

## Testing

Test credentials (from backend seed):
- Carer: `carer1@havenflow.com` / `carer123`
- Manager: `manager@havenflow.com` / `manager123`
- Admin: `admin@havenflow.com` / `admin123`

