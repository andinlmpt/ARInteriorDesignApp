# Quick Fix: ERR_CONNECTION_REFUSED

## Problem
You're seeing `ERR_CONNECTION_REFUSED` when the app tries to connect to the backend.

## Root Cause
On **physical devices**, `localhost` refers to the device itself, not your development machine. You need to use your computer's actual IP address.

## Solution (3 Steps)

### Step 1: Find Your Computer's IP Address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" - Example: 192.168.1.131
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```

### Step 2: Update Configuration

**Option A: Set Environment Variable (Recommended)**

Create or update `frontend/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1
```

**Replace `192.168.1.131` with YOUR actual IP address!**

**Option B: Set When Starting Expo**

```bash
cd frontend
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1 npm start
```

### Step 3: Restart Expo

```bash
cd frontend
npm start -- --clear
```

## Verify

### Check Backend is Running:
```bash
# Test backend
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

### Test from Mobile Device (Same Network):
- Open mobile browser
- Go to: `http://YOUR_IP:3000/health`
- Should see JSON response

## Platform-Specific Notes

### ✅ Web Browser / iOS Simulator / Android Emulator
- Already configured correctly
- Uses `localhost` or `10.0.2.2` automatically
- No changes needed

### ❌ Physical iOS/Android Device
- **MUST** use your computer's IP address
- **MUST** be on same Wi-Fi network
- **MUST** set `EXPO_PUBLIC_API_BASE_URL` environment variable

## Current Status

- ✅ Backend: Running on port 3000
- ✅ Backend Health: http://localhost:3000/health (OK)
- ✅ Your IP: 192.168.1.131 (use this in .env file)
- ⚠️ Frontend: Needs environment variable set for physical devices

## Quick Commands

```bash
# Start backend
cd backend
npm start

# Start frontend with IP (for physical devices)
cd frontend
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1 npm start

# Or create .env file first, then:
cd frontend
npm start
```

## Still Not Working?

1. **Check Firewall**: Allow port 3000 through Windows Firewall
2. **Check Network**: Ensure phone and computer are on same Wi-Fi
3. **Check Backend**: Verify `http://localhost:3000/health` works from computer
4. **Check IP**: Make sure you're using the correct IP address
5. **Clear Cache**: `npm start -- --clear`
6. **Restart Expo**: Stop and restart the Expo server
