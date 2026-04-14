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

2. Configure API URL in `src/services/api.ts`:
```typescript
const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api'  // Update with your backend URL
  : 'https://api.havenflow.com/api';
```

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

For production, you may want to use environment variables for the API URL. Install `expo-constants` and configure accordingly.

## Testing

Test credentials (from backend seed):
- Carer: `carer1@havenflow.com` / `carer123`
- Manager: `manager@havenflow.com` / `manager123`
- Admin: `admin@havenflow.com` / `admin123`

