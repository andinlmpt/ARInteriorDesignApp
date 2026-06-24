# Troubleshooting Guide

## Common Issues

### ERR_CONNECTION_REFUSED Error

This error occurs when the React Native app cannot connect to the backend server.

#### Cause
- **Physical Devices**: `localhost` refers to the device itself, not your development machine
- **Network Issues**: Devices must be on the same network as your computer
- **Backend Not Running**: Backend server is not running on port 3000

#### Solutions

##### 1. For Physical Devices (iOS/Android)

**Step 1: Find Your Computer's IP Address**

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your active network adapter
# Example: 192.168.1.131
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
# Look for your local network IP (usually 192.168.x.x or 10.x.x.x)
```

**Step 2: Set Environment Variable**

Create a `.env` file in the `frontend` directory:

```env
# Replace 192.168.1.131 with YOUR actual IP address
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1
```

Or set it when starting Expo:
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1 npm start
```

**Step 3: Ensure Both Devices Are on Same Network**
- Your computer and mobile device must be on the same Wi-Fi network
- Firewall must allow connections on port 3000

##### 2. For Emulators/Simulators

**Android Emulator:**
- Uses `10.0.2.2` automatically (already configured)
- No changes needed

**iOS Simulator:**
- Uses `localhost` automatically (already configured)
- No changes needed

**Web Browser:**
- Uses `localhost` automatically (already configured)
- No changes needed

##### 3. Verify Backend is Running

```bash
# Test backend health endpoint
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...,"environment":"development"}
```

If backend is not running:
```bash
cd backend
npm start
```

##### 4. Check Firewall Settings

**Windows:**
1. Open Windows Defender Firewall
2. Allow Node.js through firewall
3. Or temporarily disable firewall for testing

**Mac:**
```bash
# Allow incoming connections on port 3000
sudo pfctl -f /etc/pf.conf
```

**Linux:**
```bash
# Allow incoming connections on port 3000
sudo ufw allow 3000/tcp
```

### Backend Server Won't Start

**Error: `EADDRINUSE: address already in use :::3000`**

This means port 3000 is already in use.

**Solution:**
```bash
# Find process using port 3000
# Windows:
netstat -ano | findstr :3000
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :3000
kill -9 <PID>
```

### Frontend Can't Find Backend

**Symptoms:**
- Network request failed
- Connection refused
- Timeout errors

**Checklist:**
1. ✅ Backend is running on port 3000
2. ✅ Using correct IP address (not localhost for physical devices)
3. ✅ Both devices on same network
4. ✅ Firewall allows port 3000
5. ✅ Environment variable is set correctly

### Testing Connection

**From your computer:**
```bash
# Test local connection
curl http://localhost:3000/health

# Test with your IP (replace with your IP)
curl http://192.168.1.131:3000/health
```

**From mobile device (same network):**
- Open mobile browser
- Navigate to: `http://192.168.1.131:3000/health`
- Should see JSON response

## Quick Fix Summary

### For Physical Devices:
1. Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Create `frontend/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3000/api/v1
   ```
3. Restart Expo: `npm start` in frontend directory
4. Make sure backend is running: `npm start` in backend directory
5. Ensure same Wi-Fi network

### For Emulators/Simulators:
- Android Emulator: Works automatically (uses 10.0.2.2)
- iOS Simulator: Works automatically (uses localhost)
- Web: Works automatically (uses localhost)

## Your Current Configuration

- **Computer IP**: 192.168.1.131 (from ipconfig)
- **Backend Port**: 3000
- **Backend Status**: ✅ Running
- **Frontend Status**: ✅ Running

### To Fix ERR_CONNECTION_REFUSED on Physical Device:

1. Create `.env` file in `frontend/` directory:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1
   ```

2. Restart Expo:
   ```bash
   cd frontend
   npm start
   ```

3. Clear cache if needed:
   ```bash
   npm start -- --clear
   ```
