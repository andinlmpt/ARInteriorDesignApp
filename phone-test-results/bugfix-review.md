# Offline bug-fix pass — October 11, 2026

The phone was removed during this pass. This document separates local verification from the remaining live AR test.

## Review fixes

1. **Local toolchain:** `npm run android` supplies the writable, space-free Android SDK (`C:/ARAndroidSdk`) and the Unity 6000.5.1f1 NDK through the host Android Gradle properties. The shared post-export patch runs without requiring an Expo prebuild. Local builds explicitly disable prebuilt IL2CPP reuse. `npm run android -- --build-only` uses the same preparation without installing or launching on a phone.
2. **EAS:** development, preview and production profiles set `UNITY_USE_PREBUILT_IL2CPP=true`; the plugin maps it to `unity.usePrebuiltIl2Cpp=true`. Build the current export locally before EAS submission. A missing prebuilt produces an explicit error. An actual hosted EAS build has not been submitted.
3. **YOLO ownership:** scan services request one shared detector. Extra detector components cannot allocate another worker. Loading is lazy, on the first furniture scan. Scene teardown releases the worker; inactive owners are released before ownership transfers. The shared detector also owns the inference interval and in-flight state.
4. **Smoke-test release gate:** the Android intent diagnostic requires `UNITY_ANDROID && DEVELOPMENT_BUILD && !UNITY_EDITOR`. The normal Unity export uses `BuildOptions.None`, so the diagnostic is excluded from it.

## Other fixes

- YOLO schedules inference across frames and polls asynchronous output readback. Model failures release partial allocations; a timeout ends failed scans.
- Furniture floor contact uses the detection's bottom centre and the camera pose captured with that frame. It no longer uses the current phone pose or treats a tabletop hit as the floor.
- Furniture overlap checks use dimensions and rotation; detected duplicates in the same sample are rejected. Recognized objects replace overlapping plane heuristics, and changed suggestions refresh the scan visuals.
- The furniture step displays scan progress and waits for inference before advancing. Resetting a scan discards pending results.
- Frontend TypeScript errors were corrected; a styles-only file was moved outside the Expo route directory.
- A new design generation clears stale edited/final caches. Final-design loading checks the requested session. Latest Unity layout events are retained for the final save; local storage write failures now propagate instead of silently succeeding.
- Invalid JWT signatures, unsigned JWTs and expired JWTs are rejected. Owned design sessions cannot be read or overwritten by another identity. Final estimates are recomputed from the item list, and invalid dimensions/prices are rejected.
- Importing the backend app no longer starts the server or MongoDB connection. Outdated route tests now exercise the actual API; backend test commands work on Windows.
- Catalog products without images are valid. Existing initials/icon placeholders remain available; uploads are not required for these items.

## Verification

- Frontend: 31/31 tests; TypeScript passes.
- Backend: 63/63 tests, including authentication and final-design regressions.
- Export tooling: 3/3 tests, including idempotence and older-patch migration.
- Unity: 10/10 geometry and shared-detector checks passed. Final export, including detector ownership-transfer cleanup, passed in 1m 50s (`unity-export-final.log`).
- Exported player metadata contains `ARFurnitureCocoDetector` but contains neither `yoloSmokeTest` nor the smoke-test log string, confirming the diagnostic was excluded from this Unity player.
- Fresh export → `npm run android -- --build-only`: passed with no manual Unity SDK/NDK flags. Initial native verification updated 626 items (6m 56s total).
- Final-source rebuild: passed in 3m 46s; IL2CPP updated 289 items. APK: `../frontend/android/app/build/outputs/apk/debug/app-debug.apk`, built at 02:42:12 Manila time, 480,686,644 bytes. Packaged Unity metadata confirms YOLO is included and the smoke diagnostic is excluded.
- APK SHA-256: `87148458F8CAD36E350D02C2D1FB98058E2C534CB174EE338C82F0FD1DD38BD0`.
- Prebuilt IL2CPP branch: exercised locally with `:unityLibrary:buildIl2Cpp -Punity.usePrebuiltIl2Cpp=true`; explicitly skipped compilation and passed in 12s. The normal host Gradle properties remain in local compile mode (`false`).

## Remaining live test

Reconnect and unlock the phone, install the corrected APK, finish the height/outline/opening steps, and stop at **Mark existing furniture**. Keep the chair fully visible inside the scanned outline while the scan runs. Capture evidence of:

1. One detector initialization for the active scan.
2. `Detected chair` and an `AR scan` with at least one COCO suggestion.
3. An orange suggestion box in the live room view; accepting it adds an existing-furniture footprint.
4. Confirmation, persistence/reopening, generated-layout obstacle avoidance and AR alignment.
5. Cold-start responsiveness and memory after the shared-worker change.

These checks have not passed yet. The earlier camera-only chair test does not establish live room placement or the complete seven-step device flow.

The user chose to leave the corrected APK ready for later. No final-build installation or phone interaction was performed.

All export/build/check processes from this pass have finished. The Unity/IL2CPP/Gradle pipeline is free for the other collaborator.
