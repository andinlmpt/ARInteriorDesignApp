# Antigravity Development Prompt: Cross-Platform Native AR Furniture Visualization

Act as a senior React Native, Expo, Android ARCore, and iOS ARKit developer. Implement a Myty-like native AR furniture visualization system for `ARInteriorDesignApp`.

## Project Context

The app currently uses:

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- `expo-dev-client`
- `expo-camera`
- `expo-gl`
- `expo-three`
- `three`
- `GLTFLoader`
- `react-native-gesture-handler`
- `react-native-reanimated`

Existing AR-related files include:

- `frontend/app/ar-view.tsx`
- `frontend/hooks/useARRenderer.ts`
- `frontend/components/ARFurniturePlacement.tsx`
- `frontend/services/FurnitureModelLoader.ts`
- `frontend/services/ARAnchorManager.ts`
- `frontend/native/ARSessionNative.ts`
- `frontend/native/ARPlane.ts`

The current implementation is mostly AR-preview style using camera overlay and Three.js. It does not yet have real native ARCore or ARKit support.

## Goal

Build a production-minded, cross-platform native AR furniture visualization feature similar to Myty AR.

The app should support:

- Android native AR using Google ARCore
- iOS native AR using Apple ARKit
- Real plane detection
- Real hit testing / raycasting
- Stable anchors
- Real-world scale furniture placement
- Furniture movement, rotation, scaling, deletion, and reset
- Multiple placed furniture items
- Native AR fallback to the existing Three.js preview mode when native AR is unavailable

## Important Direction

Do not remove the existing Three.js preview implementation. Keep it as fallback mode.

Use this layered approach:

```txt
Native AR when available
Preview AR when native AR unavailable
```

Recommended architecture:

```txt
ARVisualizationScreen
│
├── NativeARView
│   ├── Android: ARCore
│   └── iOS: ARKit
│
├── PreviewARView fallback
│   └── CameraView + GLView + Three.js
│
├── ARSessionNative bridge
│   ├── isSupported()
│   ├── start()
│   ├── stop()
│   └── getPlanes()
│
├── ARAnchorManager
│   └── shared plane/anchor state
│
├── FurnitureModelLoader
│   └── model loading, caching, normalization
│
└── ARControlsOverlay
    └── placement, rotate, delete, reset, save
```

## Required First Step

Inspect the existing project before changing files.

Then generate native projects if they do not exist:

```bash
npx expo prebuild
```

Run from:

```txt
frontend
```

This should create:

```txt
frontend/android
frontend/ios
```

Because this app uses `expo-dev-client`, native AR must be tested in development builds, not Expo Go.

## Android Requirements

Implement Android native AR using:

```txt
Google ARCore
```

Add ARCore dependency in Android Gradle config:

```gradle
implementation "com.google.ar:core:1.45.0"
```

Use the latest compatible stable version if the project requires it.

Android native capabilities required:

- Check ARCore availability
- Request/validate camera permission
- Start ARCore session
- Stop ARCore session
- Detect horizontal planes
- Optionally detect vertical planes
- Perform hit testing against detected planes
- Create and maintain anchors
- Track camera pose
- Emit tracking state updates
- Return detected planes to JavaScript
- Render or coordinate rendering of furniture models

Android manifest should include camera and ARCore requirements.

Use optional AR support if possible so unsupported devices can still install and use preview mode:

```xml
<uses-permission android:name="android.permission.CAMERA" />

<uses-feature
    android:name="android.hardware.camera.ar"
    android:required="false" />

<meta-data
    android:name="com.google.ar.core"
    android:value="optional" />
```

## iOS Requirements

Implement iOS native AR using:

```txt
ARKit
RealityKit or SceneKit
```

Preferred:

- RealityKit for modern AR rendering
- SceneKit if it is simpler for model/entity manipulation

iOS native capabilities required:

- Check ARKit world tracking support
- Request/validate camera permission
- Start AR session using `ARWorldTrackingConfiguration`
- Enable horizontal plane detection
- Optionally enable vertical plane detection
- Use AR raycasting / hit testing
- Create and maintain anchors
- Track camera pose
- Support light estimation if practical
- Emit tracking state updates
- Return detected planes to JavaScript
- Render or coordinate rendering of furniture models

Add required iOS camera usage description if missing.

Important: iOS native development requires macOS/Xcode or EAS cloud builds.

## Shared Native Bridge

Use the existing JavaScript bridge file:

```txt
frontend/native/ARSessionNative.ts
```

The native module must register as:

```txt
ARSessionNative
```

Expose this API consistently on Android and iOS:

```ts
isSupported(): Promise<boolean>;
start(): Promise<void>;
stop(): Promise<void>;
getPlanes(): Promise<ARNativePlane[]>;
```

Extend only if necessary, but keep backward compatibility with the current JS bridge.

Recommended additional methods/events if useful:

```ts
hitTest(x: number, y: number): Promise<ARHitTestResult | null>;
createAnchor(hitResult: ARHitTestResult): Promise<ARAnchor>;
removeAnchor(anchorId: string): Promise<void>;
getTrackingState(): Promise<'tracking' | 'limited' | 'notAvailable' | 'stopped'>;
```

Recommended events:

```txt
onPlaneDetected
onPlaneUpdated
onTrackingStateChanged
onAnchorAdded
onAnchorUpdated
onAnchorRemoved
onError
```

## Plane Data Contract

Use the existing native plane shape expected by:

```txt
frontend/native/ARPlane.ts
```

Return detected planes as:

```ts
type ARNativePlane = {
  id: string;
  type: 'horizontal' | 'vertical';
  center: {
    x: number;
    y: number;
    z: number;
  };
  normal: {
    x: number;
    y: number;
    z: number;
  };
  area: number;
  confidence: number;
  timestamp: number;
  points?: Array<{
    x: number;
    y: number;
    z: number;
  }>;
};
```

Ensure coordinates are documented and consistent across Android and iOS.

## Native AR View

Create a cross-platform native AR view component:

```txt
NativeARView
```

It should internally use:

- Android: ARCore
- iOS: ARKit

The React Native component should support props/events similar to:

```ts
type NativeARViewProps = {
  selectedFurniture?: FurnitureItem | null;
  placedFurniture?: PlacedFurniture[];
  placementMode?: boolean;
  showPlanes?: boolean;
  onPlaneDetected?: (planes: ARNativePlane[]) => void;
  onFurniturePlaced?: (item: PlacedFurniture) => void;
  onFurnitureSelected?: (id: string) => void;
  onFurnitureUpdated?: (item: PlacedFurniture) => void;
  onTrackingStateChanged?: (state: string) => void;
  onError?: (message: string) => void;
};
```

Native view responsibilities:

- Display AR camera feed
- Start and stop native AR session with the component lifecycle
- Show plane visualization or placement indicator
- Support tap-to-place furniture on detected horizontal planes
- Anchor furniture to real-world plane position
- Keep furniture stable while user moves device
- Support selecting existing furniture
- Support moving, rotating, scaling, deleting, and resetting selected furniture
- Emit updates to JavaScript state

## Furniture Model Format Strategy

Use platform-specific model fields in furniture metadata.

Recommended furniture type:

```ts
type FurnitureItem = {
  id: string;
  name: string;
  category: string;
  thumbnailUrl?: string;
  defaultScale?: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  models: {
    glb?: string;
    gltf?: string;
    usdz?: string;
  };
  license?: string;
  attribution?: string;
};
```

Model usage:

- Android native AR: prefer `.glb`
- iOS native AR: prefer `.usdz` or native-compatible converted asset
- Three.js fallback: prefer `.glb`

If the existing project currently uses `modelUrl`, preserve backward compatibility by mapping it to `models.glb` where possible.

## Furniture Rendering Requirements

Rendered furniture must:

- Use real-world scale
- Respect dimensions metadata
- Sit on the detected floor plane
- Use bottom-center origin/pivot when possible
- Be rotatable around vertical axis
- Be movable on the detected plane
- Be scalable within safe bounds
- Remain anchored and stable while camera moves

Transform constraints:

```txt
minScale: 0.25
maxScale: 3.0
rotation: vertical axis only
movement: constrained to valid detected plane/anchor area when possible
```

## Furniture Placement Flow

Implement this user flow:

1. User opens furniture catalog or furniture detail.
2. User taps AR/Preview button.
3. App checks native AR support.
4. If native AR is supported, open `NativeARView`.
5. If not supported, open existing preview mode.
6. User scans room.
7. App detects floor plane.
8. App shows placement reticle.
9. User taps floor to place selected furniture.
10. Furniture is anchored to real-world position.
11. User can move, rotate, scale, delete, or reset furniture.
12. User can place multiple furniture items.

## UI Requirements

Create or update AR UI overlay with:

- Back/close button
- Current furniture item name
- Tracking/scan instruction text
- Plane detection status
- Placement reticle status
- Delete selected furniture button
- Reset selected furniture button
- Clear all furniture button
- Optional furniture selector carousel
- Loading state
- Friendly error state
- Native AR unavailable fallback prompt

Instruction text should be accurate:

- `Move your device slowly to scan the room`
- `Point your camera at the floor`
- `Tap on a detected floor area to place furniture`
- `Drag to move, pinch to scale, rotate to adjust`

Only show plane/scanning text in native AR mode. In preview fallback mode, use honest preview messaging.

## Fallback Preview Mode

Keep the current fallback implementation using:

```txt
CameraView + GLView + Three.js
```

Fallback should be used when:

- Running on web
- Device does not support ARCore/ARKit
- ARCore/ARKit is unavailable
- Camera permission is denied
- Native AR session fails
- Running on unsupported emulator/simulator
- Native module is missing

Fallback mode should still support:

- Furniture rendering
- Manual move
- Manual rotate
- Manual scale
- Reset
- Delete
- Loading/error states

Fallback should not claim real plane detection or real anchoring.

## Model Loading and Asset Pipeline

Use best practices for model assets:

- Prefer `.glb` for Android and fallback preview
- Prefer `.usdz` or iOS-native compatible format for iOS AR
- Keep models under 5-10 MB where possible
- Keep triangle count reasonable for mobile, ideally under 50k-100k
- Use 1024 or 2048 max texture sizes
- Keep material count low
- Use Blender, gltf-transform, gltfpack, Draco, or KTX2/Basis compression
- Store source/license/attribution metadata

Do not automatically download or bundle large datasets.

Recommended asset sources:

- Sketchfab for prototype `.glb` models
- CGTrader or TurboSquid for commercial models
- Poly Haven for public-domain assets and textures
- Free3D or Blend Swap for prototypes
- 3D-FUTURE and 3D-FRONT for interior design research datasets
- ShapeNet or Objaverse for research datasets

## State Management

AR state should track:

```ts
type PlacedFurniture = {
  id: string;
  furnitureId: string;
  anchorId?: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  scale: number;
};
```

Track:

- selected furniture item
- native AR supported
- native AR active
- fallback preview active
- camera permission
- tracking state
- detected planes
- placed furniture list
- selected placed furniture id
- loading/error states

## Error Handling

Handle these cases gracefully:

- ARCore unavailable
- ARKit unavailable
- Native module missing
- Camera permission denied
- AR session failed to start
- Tracking state limited/lost
- No plane detected
- Hit test failed
- Anchor creation failed
- Model failed to load
- Unsupported model format
- Device memory limitation
- Native AR view crashed or emitted error

Every error should have a safe user-facing recovery path:

- retry
- switch to preview mode
- go back
- reset session

## Performance Requirements

Optimize for mobile:

- Avoid unnecessary React state updates per frame
- Cache models where possible
- Reuse loaded assets
- Dispose unloaded models/textures/materials
- Avoid heavy real-time shadows unless stable
- Use simple plane visualization
- Use light estimation only if performant
- Stop AR session when screen unmounts
- Release native resources on view destruction

## Build and Testing Requirements

After implementation, validate:

- Existing app still builds
- Existing screens still work
- Development build works with `expo-dev-client`
- Android native AR opens on ARCore-supported device
- iOS native AR opens on ARKit-supported device
- Unsupported devices fall back to preview mode
- Camera permission flow works
- Plane detection works
- Tap-to-place works
- Furniture remains anchored when moving device
- Move/rotate/scale/delete/reset work
- Multiple furniture items work
- Closing/reopening AR screen does not crash
- Native AR resources are cleaned up

## Important Platform Notes

- Do not rely on Expo Go for native AR testing.
- Use Expo development builds.
- Android can be developed locally on Windows if Android Studio/SDK are installed.
- iOS native development requires macOS/Xcode or EAS cloud builds.
- Keep platform-specific native code isolated.
- Keep JavaScript APIs consistent across Android and iOS.

## Acceptance Criteria

The implementation is complete when:

- App supports native AR on Android via ARCore.
- App supports native AR on iOS via ARKit.
- App keeps current Three.js AR-preview fallback.
- Native AR support check works correctly.
- Detected planes are exposed to JavaScript.
- Furniture can be placed on real detected floor planes.
- Furniture is anchored and stable in real-world space.
- Furniture can be moved, rotated, scaled, selected, deleted, and reset.
- Multiple furniture items can be placed.
- Unsupported devices gracefully use preview mode.
- Model metadata supports platform-specific formats.
- Project builds successfully without breaking existing app functionality.

## Deliverable

A cross-platform Myty-like AR furniture visualization implementation using:

```txt
Android: ARCore
IOS: ARKit
React Native/Expo: native module + native AR view
Fallback: CameraView + GLView + Three.js
Models: .glb for Android/fallback, .usdz or native-compatible asset for iOS
```

Keep the implementation modular, maintainable, and compatible with the existing `ARInteriorDesignApp` architecture.
