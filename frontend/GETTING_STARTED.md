# How to Run AR Interior Design App

Complete guide to get the app running on your device or emulator.

## Prerequisites

### Required Software

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **npm** or **yarn**
   - Usually comes with Node.js
   - Verify: `npm --version`

3. **Expo CLI** (optional but recommended)
   ```bash
   npm install -g expo-cli
   ```

### For Mobile Testing

#### Option A: Expo Go (Easiest - Recommended for Testing)
- **iOS**: Download [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from App Store
- **Android**: Download [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) from Google Play

#### Option B: Emulator/Simulator
- **iOS**: Requires macOS with Xcode installed
- **Android**: Requires Android Studio and Android SDK

## Installation Steps

### 1. Navigate to Project Directory

```bash
cd ARInteriorDesinApp
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages from `package.json`.

**Note**: If you encounter errors, try:
```bash
npm install --legacy-peer-deps
```

### 3. Start the Development Server

```bash
npm start
```

Or using npx directly:
```bash
npx expo start
```

This will:
- Start the Metro bundler
- Open Expo DevTools in your browser
- Display a QR code in the terminal

## Running on Different Platforms

### 📱 On Physical Device (Expo Go)

#### Method 1: Scan QR Code
1. Open **Expo Go** app on your phone
2. Scan the QR code displayed in the terminal
3. The app will load automatically

#### Method 2: Manual Connection
1. Make sure your phone and computer are on the **same Wi-Fi network**
2. In Expo Go app, tap **"Enter URL manually"**
3. Enter the URL shown in terminal (e.g., `exp://192.168.1.100:8081`)

#### Troubleshooting Connection Issues
```bash
# If QR code doesn't work, try tunnel mode
npx expo start --tunnel

# Or LAN mode
npx expo start --lan

# Clear cache and restart
npx expo start --clear
```

### 🤖 Android Emulator

**Prerequisites**:
- Android Studio installed
- Android emulator created and running

**Steps**:
```bash
# Start Android emulator from Android Studio first
# Then run:
npm run android

# Or:
npx expo start --android
```

### 🍎 iOS Simulator (macOS only)

**Prerequisites**:
- macOS
- Xcode installed
- iOS Simulator available

**Steps**:
```bash
npm run ios

# Or:
npx expo start --ios
```

### 🌐 Web Browser

```bash
npm run web

# Or:
npx expo start --web
```

**Note**: Some features (camera, AR) won't work in web browser.

## Available Commands

```bash
# Start development server
npm start

# Start for Android
npm run android

# Start for iOS
npm run ios

# Start for Web
npm run web

# Lint code
npm run lint

# Clear cache and start
npx expo start --clear

# Start with tunnel mode (for testing across networks)
npx expo start --tunnel
```

## First Time Setup Issues

### Port Already in Use

If port 8081 is already in use:
```bash
# Kill process on port 8081
# Windows:
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:8081 | xargs kill -9

# Or use different port
npx expo start --port 8082
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Clear Expo cache
npx expo start --clear
```

### Metro Bundler Issues

```bash
# Reset Metro bundler cache
npx expo start --clear

# Or manually clear cache
watchman watch-del-all
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
```

## Running the Backend (Required for Login)

Login and most API features need the backend server running on your computer.

### Start the backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on **port 3000** by default and listens on all network interfaces (`0.0.0.0`) so phones on the same Wi‑Fi can reach it.

| Endpoint | URL |
|----------|-----|
| Health check | `http://localhost:3000/health` |
| API base | `http://localhost:3000/api/v1` |
| Login | `POST http://localhost:3000/api/v1/users/login` |

### Start the frontend (separate terminal)

```bash
cd frontend
npm install
npm start
```

### Verify the backend is running

```bash
# Windows PowerShell
Invoke-WebRequest http://localhost:3000/health
```

You should see `{"status":"ok",...}`.

### Backend: port 3000 already in use (`EADDRINUSE`)

If you see `Error: listen EADDRINUSE: address already in use :::3000`, the backend is **already running**. You do not need to start it again.

Starting a second instance will either:
- Print **"Backend is already running"** and exit cleanly (current behavior), or
- Crash with `EADDRINUSE` on older setups

To **restart** the backend:

```bash
# Windows — find the process
netstat -ano | findstr :3000

# Kill it (replace <PID> with the number from the last column)
taskkill /PID <PID> /F

# Start fresh
cd backend
npm run dev
```

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9
cd backend && npm run dev
```

See also: [`backend/README.md`](../backend/README.md) for full backend documentation.

## Environment Variables (Optional)

Create a `.env` file in the `frontend/` directory for optional configuration:

```env
# Backend API URL (optional — auto-detected in Expo Go on physical devices)
# Only needed if login fails or you use a custom port
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_IP:3000/api/v1

# OpenAI API Key (optional, for AI features)
EXPO_PUBLIC_OPENAI_API_KEY=your-api-key-here

# Replicate API Token (optional)
EXPO_PUBLIC_REPLICATE_API_TOKEN=your-token-here
```

### How the app finds the backend

`frontend/services/apiClient.ts` picks the API URL in this order:

1. `EXPO_PUBLIC_API_BASE_URL` or `EXPO_PUBLIC_LAYOUT_API_BASE_URL` from `.env`
2. **Auto-detect** from Expo’s bundler host when using Expo Go on a physical device (e.g. `http://192.168.1.5:3000/api/v1`)
3. Platform defaults:
   - **Web / iOS Simulator** → `http://localhost:3000/api/v1`
   - **Android Emulator** → `http://10.0.2.2:3000/api/v1`

> **Physical device + Expo Go:** The app usually detects your PC’s LAN IP automatically. Phone and computer must be on the **same Wi‑Fi**. If login still fails, set `EXPO_PUBLIC_API_BASE_URL` manually (find your IP with `ipconfig` on Windows or `ifconfig` on Mac/Linux).

## Testing the App

### Login Credentials (Test Users)

The app includes test users:

| Email | Password |
|-------|----------|
| john@example.com | password123 |
| jane@example.com | password123 |
| admin@ardesign.com | admin123 |
| test@test.com | test123 |

### First Run Flow

1. **Splash Screen** → Shows app branding
2. **Onboarding** (first time only) → Tutorial slides
3. **Login Screen** → Sign in with test credentials
4. **Home Screen** → Main dashboard with quick actions

## Development Tips

### Hot Reload
- The app automatically reloads when you save files
- Press `r` in terminal to reload manually
- Press `m` to toggle menu

### Debugging
- Shake device to open developer menu (Expo Go)
- Use React Native Debugger for advanced debugging
- Check terminal for error logs

### Performance
- Close unused apps on your device
- Use release mode for better performance:
  ```bash
  npx expo start --no-dev --minify
  ```

## Common Issues & Solutions

### Issue: `Unable to resolve module expo-three` (red screen on Expo Go)

**Cause:** The app uses Three.js via `expo-gl`, but the `expo-three` npm package is **not installed** (and is unmaintained on Expo SDK 53+).

**Solution:** The project uses a local replacement at `frontend/utils/ExpoThreeRenderer.ts`. Hooks import `ExpoThreeRenderer` from there — **do not** add `expo-three` to `package.json`.

If you still see this error after a code update:

```bash
cd frontend
npx expo start --clear
```

Reload the app on your device (press **R** twice in the terminal or tap **Reload** in Expo Go).

### Issue: Login fails / "Network request failed" / "Connection refused"

**Cause:** The phone cannot reach the backend on your computer.

**Checklist:**
1. Backend is running (`http://localhost:3000/health` returns OK on your PC)
2. Phone and PC are on the **same Wi‑Fi**
3. Reload the Expo app after starting the backend
4. Check the Metro logs for `[API] POST http://...` — the URL should be your PC’s LAN IP, not `localhost` or `10.0.2.2` (unless you use an emulator)

**Manual fix** — create `frontend/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000/api/v1
```

Replace `192.168.x.x` with your computer’s IPv4 address (`ipconfig` on Windows).

### Issue: Backend `EADDRINUSE` on port 3000

See [Running the Backend](#running-the-backend-required-for-login) above. The server is likely already running.

### Issue: "Unable to resolve module"
**Solution**: 
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Issue: "Network request failed" (general)

**Solution**: 
- Ensure the **backend** is running (`cd backend && npm run dev`)
- Check Wi-Fi connection — phone and PC on the same network
- Try tunnel mode: `npx expo start --tunnel`
- Set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` if auto-detection fails

### Issue: App crashes on startup
**Solution**:
- Check for syntax errors in code
- Clear cache: `npx expo start --clear`
- Check Expo Go app is up to date

### Issue: Camera permissions denied
**Solution**:
- Grant camera permissions in device settings
- Restart Expo Go app

## Production Build

When ready to build for production:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## Next Steps

1. ✅ Install backend dependencies: `cd backend && npm install`
2. ✅ Start backend: `cd backend && npm run dev`
3. ✅ Install frontend dependencies: `cd frontend && npm install`
4. ✅ Start dev server: `cd frontend && npm start`
5. ✅ Scan QR code with Expo Go app (same Wi‑Fi as your PC)
6. ✅ Test login with provided credentials
7. ✅ Explore features:
   - AI Design Generation
   - Theme Recommendations
   - Spatial Mapping
   - AR View
   - 3D Layout Visualization

## Need Help?

- Check [Expo Documentation](https://docs.expo.dev/)
- Visit [Expo Discord](https://chat.expo.dev)
- Review error messages in terminal
- Check device logs in Expo Go app

---

**Ready to design?** 🎨

Start the server and scan the QR code to begin!

