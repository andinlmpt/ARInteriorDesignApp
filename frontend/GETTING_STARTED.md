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

## Running the Backend (Optional)

If you want to use the backend server:

```bash
cd backend
npm install
npm start
```

The backend runs on `http://localhost:3000` by default.

## Environment Variables (Optional)

Create a `.env` file in the root directory for optional configuration:

```env
# OpenAI API Key (optional, for AI features)
OPENAI_API_KEY=your-api-key-here

# Unity Build URL (optional, for 3D visualization)
UNITY_BUILD_URL=https://your-cdn.com/unity-build/index.html

# Backend URL (optional, defaults to localhost:3000)
BACKEND_URL=http://localhost:3000
```

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

### Issue: "Unable to resolve module"
**Solution**: 
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Issue: "Network request failed"
**Solution**: 
- Check Wi-Fi connection
- Try tunnel mode: `npx expo start --tunnel`
- Ensure phone and computer on same network

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

1. ✅ Install dependencies: `npm install`
2. ✅ Start dev server: `npm start`
3. ✅ Scan QR code with Expo Go app
4. ✅ Test login with provided credentials
5. ✅ Explore features:
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

