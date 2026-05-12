# 🏠 AR Interior Design App

Professional interior design application with AI-powered recommendations, AR visualization, and 3D layout planning.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm** or **yarn**
- **Expo Go** app on your phone (iOS/Android) - [Download iOS](https://apps.apple.com/app/expo-go/id982107779) | [Download Android](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npm start
   ```

3. **Open on your device**
   - Open **Expo Go** app on your phone
   - Scan the QR code from the terminal
   - Or press `a` for Android, `i` for iOS simulator

## 📱 Running on Different Platforms

```bash
# Development server (shows QR code)
npm start

# Android emulator (requires Android Studio)
npm run android

# iOS simulator (requires Xcode on macOS)
npm run ios

# Web browser
npm run web

# Clear cache and restart
npx expo start --clear
```

## 🔑 Test Login Credentials

| Email | Password |
|-------|----------|
| john@example.com | password123 |
| jane@example.com | password123 |
| admin@ardesign.com | admin123 |
| test@test.com | test123 |

## 🎯 Features

- ✨ **AI Design Generation** - Generate interior designs with AI
- 🎨 **Theme Recommendations** - Get personalized style suggestions
- 📷 **AR Room Scanning** - Scan and map rooms in 3D
- 🏠 **3D Layout Visualization** - View designs in 3D
- 📐 **Spatial Mapping** - Accurate room measurements
- 💾 **Project Management** - Save and manage design projects

## 🛠️ Development

### Project Structure
```
ARInteriorDesinApp/
├── app/              # Screen components (Expo Router)
├── components/       # Reusable UI components
├── services/         # Business logic & API services
├── types/            # TypeScript type definitions
├── backend/          # Backend server (optional)
└── docs/             # Documentation
```

### Available Scripts
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Check code quality

## 🐛 Troubleshooting

### Connection Issues
```bash
# Try tunnel mode if QR code doesn't work
npx expo start --tunnel

# Ensure phone and computer are on same Wi-Fi
```

### Module Errors
```bash
# Clear and reinstall dependencies
rm -rf node_modules
npm install
npx expo start --clear
```

### Port Already in Use
```bash
# Use different port
npx expo start --port 8082
```

## 📚 Documentation

- **Getting Started Guide**: See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed instructions
- **Unity Integration**: See [docs/UNITY_SETUP.md](./docs/UNITY_SETUP.md) for 3D visualization setup
- **Backend Setup**: See [backend/README.md](./backend/README.md) for backend configuration

## 🏗️ Backend (Optional)

To run the backend server:

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3000` by default.

## 📦 Environment Variables (Optional)

Create `.env` file for configuration:

```env
OPENAI_API_KEY=your-api-key-here
UNITY_BUILD_URL=https://your-cdn.com/unity-build/index.html
```

## 🎨 Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **3D Rendering**: Three.js + Expo GL
- **State Management**: React Hooks + AsyncStorage
- **Backend**: Node.js + Express (optional)
- **TypeScript**: Type-safe development

## 📖 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)

## 🤝 Support

Need help? Check:
- [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup
- Terminal error messages
- Expo DevTools in browser
- [Expo Discord Community](https://chat.expo.dev)

---

**Happy Designing!** 🎨✨

