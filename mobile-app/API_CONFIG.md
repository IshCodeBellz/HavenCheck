# Mobile App API Configuration

## Network Setup for Physical Devices

When testing on a **physical device**, you cannot use `localhost` because the device doesn't know what "localhost" refers to. You need to use your computer's IP address.

### Finding Your Computer's IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig | findstr IPv4
```

### Current Configuration

The API URL is configured in `src/services/api.ts`:

```typescript
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.86:3001/api' // Your computer's IP
  : 'https://api.havenflow.com/api'; // Production URL
```

### Important Notes

1. **IP Address Changes**: Your IP address may change if you:
   - Connect to a different WiFi network
   - Restart your router
   - Have a dynamic IP assignment

2. **Firewall**: Make sure your computer's firewall allows connections on port 3001

3. **Same Network**: Your phone and computer must be on the same WiFi network

4. **iOS Simulator**: iOS Simulator can use `localhost` (no change needed)

5. **Android Emulator**: 
   - Use `10.0.2.2` instead of `localhost` for Android emulator
   - Or use your computer's IP address

### Testing Connection

Test if your device can reach the backend:
```bash
# From your computer, check if backend is accessible
curl http://YOUR_IP:3001/health
```

### Troubleshooting

**"Network request failed" error:**
- Verify backend is running: `curl http://localhost:3001/health`
- Check your IP address hasn't changed
- Ensure phone and computer are on same WiFi network
- Try accessing `http://YOUR_IP:3001/health` in phone's browser

**"Invalid credentials" error:**
- Verify backend is running and accessible
- Check API URL is correct in `src/services/api.ts`
- Test login with curl: `curl -X POST http://YOUR_IP:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"carer1@havenflow.com","password":"carer123"}'`

### Test Credentials

- **Admin**: `admin@havenflow.com` / `admin123`
- **Manager**: `manager@havenflow.com` / `manager123`
- **Carer**: `carer1@havenflow.com` / `carer123`

