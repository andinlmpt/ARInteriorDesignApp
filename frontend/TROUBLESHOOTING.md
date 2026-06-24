# Troubleshooting & Known Issues

This document contains solutions for common issues encountered during the development of this application, specifically relating to Expo, Three.js, and React Native compatibility.

## 1. "private properties are not supported" (Hermes Engine Crash)

**Error Message:**
```
[runtime not ready]: SyntaxError: 36318:5:private properties are not supported, stack: ...
```

**Root Cause:**
This error occurs when the Hermes JavaScript engine (used by Android/iOS on React Native) encounters modern ECMAScript private class fields (e.g., `#privateField`) but isn't a new enough version to support them, AND Babel failed to downcompile them. 

In our case, this was caused by a mismatch in the `babel-preset-expo` version. The project was on Expo SDK 54, but npm had installed `babel-preset-expo@56`. The newer Babel preset assumed Hermes already supported private fields natively and stopped transforming them, causing `react-native`'s core code (like `Animation.js`) to crash the app.

**The Fix:**
1. Always ensure your Expo dependencies match your SDK version.
2. Run `npx expo install --check` or `npx expo install --fix` to automatically align the packages.
3. This downgraded `babel-preset-expo` back to the `~54.0.10` version, which properly transforms private properties for the Hermes version included with Expo Go 54.
4. Clear the Metro bundler cache: `npx expo start -c`.

---

## 2. "DOMException doesn't exist" / Missing Browser Globals

**Error Message:**
```
[runtime not ready]: ReferenceError: Property 'DOMException' doesn't exist
```

**Root Cause:**
Libraries designed for the web (like `three.js` or `expo-three`) often assume the presence of browser-specific global variables like `window`, `self`, or `DOMException`. React Native's JS environment does not provide these by default.

**The Fix:**
Instead of relying on heavy unmaintained polyfills (like `@expo/browser-polyfill`), the best solution is to manually polyfill just what is needed if it's missing. However, in our project, this error was actually a side effect of using the unmaintained `expo-three` package (see below).

---

## 3. The `expo-three` Library & Dependency Chains

**Issue:**
The `expo-three` library (v8.0.0) is unmaintained and causes severe compatibility issues with modern Expo SDKs (SDK 53+). It pulls in `@expo/browser-polyfill` which cascades into bringing old, broken packages like `fbemitter` and `expo-2d-context`. These packages trigger the global errors and private property errors discussed above.

**The Fix:**
Do **not** use `expo-three`. 

We removed `expo-three` entirely from the `package.json` and replaced its only used export (`Renderer`) with a local, 50-line drop-in replacement (`utils/ExpoThreeRenderer.ts`). This local wrapper provides the exact same `THREE.WebGLRenderer` functionality but without pulling in the 34+ incompatible sub-dependencies.

If you need a WebGL renderer for Three.js, use `utils/ExpoThreeRenderer.ts` directly.

---

## 4. "No route named [route_name] exists in nested children"

**Error Message:**
```
[Layout children]: No route named "settings" exists in nested children...
```

**Root Cause:**
Expo Router warns when a route is defined in the navigation configuration (or dynamically attempted to be routed to) but no corresponding file exists in the `app/` directory.

**The Fix:**
Ensure your `config/navigation.config.ts` (or wherever routes are typed/defined) perfectly matches the file structure in the `app/` directory. We removed the phantom `'settings'` route from `navigation.config.ts` and the `ScreenName` type union since `app/settings.tsx` does not exist.

---

## 5. "expo-notifications functionality was removed from Expo Go"

**Error Message:**
```
expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53.
```

**Root Cause:**
Expo has been slimming down the Expo Go client. As of SDK 53, push notifications no longer work inside the standard Expo Go app.

**The Fix:**
This is a non-fatal warning; the app will still run. However, to test push notifications during development, you must create a Custom Development Build instead of using Expo Go:
```bash
npx expo run:android
# or
npx expo run:ios
```
