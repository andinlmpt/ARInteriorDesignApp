# How to Run the System

## Quick Start (Recommended)

Run both backend and frontend together:

```bash
# From the root directory
npm run dev
```

This will start:
- ✅ Backend server on `http://localhost:3000`
- ✅ Frontend Expo server (usually on port 8081)

## Step-by-Step Instructions

### 1. Install Dependencies (First Time Only)

```bash
# Install all dependencies (root, frontend, and backend)
npm run install:all

# Or install separately:
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
cd ../backend && npm install   # Backend dependencies
```

### 2. Start the System

#### Option A: Run Both Together (Recommended)
```bash
# From root directory
npm run dev
```

#### Option B: Run Separately (In Separate Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### 3. Access the Application

After starting, you'll see:

**Backend:**
- Running on: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- API endpoint: `http://localhost:3000/api/v1`

**Frontend (Expo):**
- Expo DevTools will open automatically
- Scan QR code with Expo Go app (iOS/Android)
- Or press:
  - `a` for Android emulator
  - `i` for iOS simulator
  - `w` for web browser

## Platform-Specific Commands

### For Android
```bash
cd frontend
npm run android
# Or use: expo start --android
```

### For iOS (Mac only)
```bash
cd frontend
npm run ios
# Or use: expo start --ios
```

### For Web
```bash
cd frontend
npm run web
# Or use: expo start --web
```

## Environment Configuration

### For Physical Devices (Important!)

If you're testing on a physical device, you need to set the API URL:

**Step 1: Find your computer's IP**
```powershell
# Windows
ipconfig
# Look for "IPv4 Address" - Example: 192.168.1.131
```

```bash
# Mac/Linux
ifconfig
# or
ip addr
```

**Step 2: Create `.env` file in `frontend/` directory**
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.131:3000/api/v1
```

**Replace `192.168.1.131` with YOUR actual IP address!**

**Step 3: Restart Expo**
```bash
cd frontend
npm start -- --clear
```

## Verification

### Check Backend is Running
```bash
# Test backend health endpoint
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...,"environment":"development"}
```

### Check Frontend
- Open Expo DevTools (usually opens automatically)
- Scan QR code with Expo Go app
- Or open in browser/emulator

## Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` error:

**Windows:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# Find and kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Dependencies Not Installed

```bash
# Install all dependencies
npm run install:all
```

### Clear Cache and Restart

```bash
# Frontend - clear Expo cache
cd frontend
npm start -- --clear

# Backend - just restart
cd backend
npm start
```

## Common Commands Summary

```bash
# Install everything
npm run install:all

# Run both (recommended)
npm run dev

# Run backend only
npm run start:backend
# or
cd backend && npm start

# Run frontend only
npm run start:frontend
# or
cd frontend && npm start

# Frontend platform-specific
cd frontend
npm run android  # Android
npm run ios      # iOS (Mac only)
npm run web      # Web browser

# Clear cache and restart
cd frontend && npm start -- --clear
```

## Development Workflow

1. **Start the system:**
   ```bash
   npm run dev
   ```

2. **Make changes:**
   - Frontend: Hot reloads automatically
   - Backend: Restart server if needed (or use `npm run dev` in backend for watch mode)

3. **Test on device:**
   - Scan QR code with Expo Go app
   - Ensure `.env` file is set for physical devices

4. **Stop the system:**
   - Press `Ctrl+C` in the terminal
   - Both servers will stop

## Notes

- **Backend port:** 3000 (configurable in `backend/src/server.js`)
- **Frontend port:** 8081 (default Expo port)
- **Physical devices:** Must use computer's IP address (not localhost)
- **Emulators/Simulators:** Use localhost automatically
- **Web browser:** Use localhost automatically
