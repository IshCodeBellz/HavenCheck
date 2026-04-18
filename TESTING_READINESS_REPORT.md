# Testing readiness — HavenCheck

**Last updated:** April 2026

## Purpose

This document lists what must be true on a developer machine before manual QA, and gives a minimal smoke path. It does not score “completeness” of the product; feature scope is described in `README.md` and `docs/CAPABILITIES.md`.

## Prerequisites

### Backend

- Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, and other values your environment needs.
- Create the PostgreSQL database (for example `havenflow`).
- From `backend/`: `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:seed` (seed supplies demo users; organisation code **`HFL`**).

### Web portal

- `web-portal/.env.local` with at least `NEXT_PUBLIC_API_URL=http://localhost:3001/api` (plus Supabase keys if you use those code paths — see `web-portal/README.md`).

### Mobile app

- `npm install` under `mobile-app/`.
- API reachability: set `EXPO_PUBLIC_API_ORIGIN` (and optional `EXPO_PUBLIC_API_PORT`) or rely on dev auto-detection — see `mobile-app/README.md` and `mobile-app/API_CONFIG.md`.

## Smoke checks

### API

1. `GET http://localhost:3001/health` returns JSON with `status: "ok"`.
2. `POST http://localhost:3001/api/v1/auth/login` with seeded admin credentials and organisation code `HFL` returns a JWT.
3. `GET http://localhost:3001/api/v1/auth/me` with `Authorization: Bearer <token>` returns the user profile.

### Web

1. `npm run dev` in `web-portal/` starts without build errors.
2. Login page loads at `/login` and a seeded user can authenticate.

### Mobile

1. `npm start` in `mobile-app/` starts Metro.
2. App renders the login screen and can reach the API from the simulator or device you are using.

## Automated tests

There is no shared automated test suite checked in for the backend, web portal, or mobile app in this repository. Manual testing follows the flows in `README.md` (role-based sections) and the route list in `backend/API_IMPLEMENTATION.md`.

## Seeded credentials (after `prisma:seed`)

| Role    | Email                  | Password   |
|---------|------------------------|------------|
| Admin   | admin@havenflow.com    | admin123   |
| Manager | manager@havenflow.com  | manager123 |
| Carer   | carer1@havenflow.com   | carer123   |

Organisation code for login: **`HFL`**.
