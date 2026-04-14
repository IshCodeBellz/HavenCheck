# Haven Flow Web Portal

Next.js web portal for Haven Flow carers, managers, and admins.

## Features

**Carers (web)** sign in with the same account as the mobile app. They see **My day**, **My visits**, **My roster** (read-only), and **Availability**, and can **clock in/out** and **add notes** on visit details (browser location).

**Managers & admins** additionally get **Clients**, **Carers**, full **Schedules** (create/edit/delete), **Checklists** (templates), and the org-wide **Dashboard**.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
Create a `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

3. Run development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
app/
  ├── dashboard/     # Dashboard page
  ├── clients/       # Clients management
  ├── carers/        # Carers management
  ├── schedules/     # Schedules management
  ├── visits/        # Visits listing
  ├── checklists/    # Checklist templates
  ├── availability/  # Carer availability
  └── login/         # Login page
lib/
  ├── api.ts       # API client
  └── auth.ts      # Authentication utilities
components/
  └── Layout.tsx   # Main layout component
```

## Authentication

The app uses JWT tokens stored in localStorage. Protected routes should check authentication status.
