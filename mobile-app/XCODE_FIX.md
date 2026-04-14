# Fixing iOS Simulator Error

## Problem
Error: `xcrun simctl help exited with non-zero code: 69`

This error occurs because the Xcode license agreement hasn't been accepted.

## Solution

### Step 1: Accept Xcode License Agreement

Open Terminal and run:

```bash
sudo xcodebuild -license
```

**Important:** You'll need to:
1. Enter your password when prompted
2. Read through the license agreement
3. Type `agree` and press Enter to accept

**Note:** If you see a prompt asking you to press space to continue reading, keep pressing space until you reach the end, then type `agree`.

### Step 2: Verify Fix

After accepting the license, verify it works:

```bash
xcrun simctl help
```

You should see the simctl help output instead of an error.

### Step 3: Restart Expo

After accepting the license, restart your Expo development server:

```bash
cd mobile-app
npm start
```

## Alternative: Use Physical Device or Web

If you don't want to deal with the simulator right now, you can:

1. **Use a physical device**: 
   - Scan the QR code with Expo Go app
   - The API is already configured for your IP address

2. **Use web version**:
   ```bash
   npm run web
   ```

## Additional Troubleshooting

If the license acceptance doesn't work:

1. **Check Xcode installation:**
   ```bash
   xcode-select -p
   ```
   Should show: `/Applications/Xcode.app/Contents/Developer`

2. **Reset Xcode path (if needed):**
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   ```

3. **Reinstall command-line tools:**
   ```bash
   xcode-select --install
   ```

## Quick Command Reference

```bash
# Accept license (requires password)
sudo xcodebuild -license

# Verify simctl works
xcrun simctl help

# List available simulators
xcrun simctl list devices
```

