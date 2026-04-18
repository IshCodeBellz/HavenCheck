# Mobile app API configuration

## Overview

The mobile client builds two base URLs in `src/services/api.ts`:

* **Legacy API:** `${API_ORIGIN}/api` — visits, notes, many mobile flows  
* **v1 API:** `${API_ORIGIN}/api/v1` — open shifts, guardian routes, and other v1 routers  

`API_ORIGIN` is resolved from environment variables and Expo host metadata (see `README.md`).

## Key capabilities

* **`EXPO_PUBLIC_API_ORIGIN`** — optional explicit origin (no trailing slash), e.g. `http://192.168.1.10:3001` for a device on the same LAN  
* **`EXPO_PUBLIC_API_PORT`** — optional port when origin is inferred from Expo LAN IP in development  
* **Production** — when `__DEV__` is false, the code falls back to `https://api.havenflow.com` unless you set `EXPO_PUBLIC_API_ORIGIN`

## How it works

1. Start the backend on port **3001** (or change your env to match).  
2. On a **physical device**, set `EXPO_PUBLIC_API_ORIGIN` to your computer’s LAN IP and port so `http://localhost` is never used on-device.  
3. **iOS Simulator** can reach `http://127.0.0.1:3001` via the default dev resolution on many setups; **Android Emulator** often needs `10.0.2.2` instead of `localhost` if you hard-code an origin.  
4. Verify reachability: `curl http://<host>:3001/health` from your machine.

### Login request shape

v1 login requires organisation code, for example:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carer1@havenflow.com","organizationCode":"HFL","password":"carer123"}'
```
