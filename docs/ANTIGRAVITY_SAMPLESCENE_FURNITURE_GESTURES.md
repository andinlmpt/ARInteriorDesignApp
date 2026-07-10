# Antigravity Task: AR Furniture Rendering + Gestures in SampleScene

> **Hand this document to Antigravity** to implement furniture placement and touch gestures in the Unity `SampleScene` project.

---

## Project

| Item | Value |
|------|-------|
| **Repo path** | `D:\project\ARInteriorDesignApp-main\InteriorDesignViewer` |
| **Unity version** | 6000.x (Unity 6) |
| **Target scene** | `Assets/Scenes/SampleScene.unity` |
| **Stack** | AR Foundation, XR Origin (Mobile AR), Input System (Enhanced Touch), URP |

---

## Goal

The user already has a **placement indicator** detecting AR surfaces in SampleScene.

Next, implement:

1. **Furniture rendering** after the indicator is shown and locked on a valid floor
2. Touch gestures for:
   - **Place** — tap to spawn furniture at the indicator
   - **Move** — drag furniture along the floor
   - **Rotate** — twist / swipe to rotate around Y
   - **Scale** — pinch to resize

Deliver IKEA-style AR furniture placement: grounded on floor, anchored, with blob shadow.

---

## Current State (Do NOT Break)

### SampleScene hierarchy (already exists)

```
SampleScene
├── Directional Light
├── XR Origin
│   ├── ARRaycastManager
│   ├── ARPlaneManager (DetectionMode: all planes — set to Horizontal for furniture)
│   ├── XROrigin
│   └── Camera Offset → Main Camera (AR Camera Manager + AR Camera Background)
├── AR Session (ARSession + ARInputManager)
└── PointerController
    └── Plane (placement indicator visual — uses cursor.mat)
```

`PointerController` uses `PlacementManager.cs` — a basic prototype that raycasts from screen center and shows a plane.

**Replace this with the production AR pipeline below.** Do not leave two competing placement systems.

### Scripts already in repo (REUSE — extend, don't rewrite)

| File | Role |
|------|------|
| `Assets/Scripts/AR/ARPlacementIndicator.cs` | Reticle with Searching/Locked states, floor validation, `IsLockedOnFloor`, `CurrentPose`, `CurrentPlane` |
| `Assets/Scripts/AR/ARFurniturePlacer.cs` | Scan → Ready → Placed state machine, tap-to-place, spawn animation, anchors, floor grounding |
| `Assets/Scripts/AR/ARFurnitureGrounding.cs` | `AlignToFloor`, blob shadow, footprint helpers |
| `Assets/Scripts/AR/FurnitureCatalog.cs` | Prefab lookup by id |
| `Assets/Scripts/AR/UnityMessageBridge.cs` | RN bridge (`selectFurniture`, `clearFurniture`) |
| `Assets/Scripts/PlacementManager.cs` | **Legacy** — remove from scene after migration |

### Missing script (MUST CREATE)

`ARFurnitureGestureController.cs` is referenced in `ARFurniture.unity` but **the .cs file does not exist**.

Create it with GUID `b626e49182bb8a547a48c71813cfe7dc` **or** update scene references after creation.

Expected serialized fields (match `ARFurniture.unity`):

```csharp
[SerializeField] ARFurniturePlacer placer;
[SerializeField] bool requireTouchOnFurniture = false;
[SerializeField] LayerMask furnitureLayerMask = ~0;
[SerializeField] float dragSmoothSpeed = 0f;          // 0 = instant snap
[SerializeField] float rotationSensitivity = 0.5f;
[SerializeField] float scaleSensitivity = 1f;
[SerializeField] float minScaleMultiplier = 0.3f;
[SerializeField] float maxScaleMultiplier = 3f;
[SerializeField] bool verboseLogging = false;
```

### Available assets

| Asset | Path |
|-------|------|
| Default furniture prefab | `Assets/Prefabs/TestSofa.prefab` |
| More prefabs | `Assets/ThirdParty/ARProjectFurniture/Prefabs/` (sofa, chair, table, etc.) |
| Blob shadow | `Assets/Prefabs/ARBlobShadow.prefab` |
| Cursor material | `Assets/Materials/cursor.mat` |

### Reference scene (copy wiring from here)

`Assets/Scenes/ARFurniture.unity` has the correct Managers wiring — use it as a template for SampleScene.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ARFurniturePlacer (state machine)                          │
│  Scanning → ReadyToPlace → Placed                           │
│  • Owns tap-to-PLACE (first tap + reposition tap)           │
│  • Calls ARPlacementIndicator StartTracking/StopTracking    │
│  • Instantiates prefab, anchor, spawn animation, blob shadow│
└──────────────────────┬──────────────────────────────────────┘
                       │ PlacedInstance, TryGetFloorHeight...
┌──────────────────────▼──────────────────────────────────────┐
│  ARFurnitureGestureController (post-placement manipulation) │
│  • MOVE: 1-finger drag on furniture (or anywhere if         │
│    requireTouchOnFurniture=false)                           │
│  • ROTATE: 2-finger twist OR 1-finger horizontal swipe      │
│  • SCALE: 2-finger pinch                                    │
│  • Must NOT conflict with placer's tap-to-place             │
└─────────────────────────────────────────────────────────────┘
```

### Gesture conflict rules

- When `PlacedInstance == null`: only placer handles input (tap to place).
- When furniture exists:
  - **Single tap on empty floor** → placer repositions (existing behavior).
  - **Single-finger drag** → gesture controller moves furniture.
  - **Two-finger pinch** → scale.
  - **Two-finger rotate** → rotate Y axis.
- Use `UnityEngine.InputSystem.EnhancedTouch` (already used in `ARFurniturePlacer`).
- Enable Enhanced Touch in `OnEnable`.

---

## Implementation Requirements

### 1. Wire SampleScene (Inspector setup)

#### A. XR Origin — add components

- `AR Anchor Manager`
- Set `AR Plane Manager` → Detection Mode: **Horizontal**

#### B. Replace PointerController pipeline

**Option A (preferred):** Rename/repurpose `PointerController` → `PlacementIndicator`

- Remove `PlacementManager` component
- Add `ARPlacementIndicator` component
- Assign:
  - `raycastManager` → XR Origin's ARRaycastManager
  - `indicatorRenderer` → child Plane's MeshRenderer
  - `lockedMaterial` / `searchingMaterial` — create or use cursor.mat variants (green = locked, dim = searching)
  - `screenY` = 0.35

#### C. Create hierarchy objects

```
Managers (empty GameObject at root)
├── ARFurniturePlacer
├── ARFurnitureGestureController
├── FurnitureCatalog
└── UnityMessageBridge

FurnitureRoot (empty, child of XR Origin or AR Session space)
```

#### D. Wire ARFurniturePlacer

| Field | Value |
|-------|-------|
| raycastManager | XR Origin |
| planeManager | XR Origin |
| anchorManager | XR Origin |
| placementIndicator | PlacementIndicator object |
| furnitureParent | FurnitureRoot |
| arCamera | Main Camera |
| furniturePrefab | TestSofa.prefab |
| blobShadowPrefab | ARBlobShadow.prefab |
| hideIndicatorAfterPlace | true |
| animateSpawn | true |
| spawnDuration | 0.45 |

Tune scanning for faster dev testing:

- `scanMinArea` = 0.25
- `scanRequiredDuration` = 1.5
- `scanMinAreaGrowth` = 0.1

#### E. Wire ARFurnitureGestureController

- `placer` → Managers / ARFurniturePlacer

#### F. Wire FurnitureCatalog

- Add entry: `id` = `test-sofa`, prefab = TestSofa
- `defaultPrefab` = TestSofa

#### G. Wire UnityMessageBridge

- `placer` + `catalog` references

---

### 2. Create `ARFurnitureGestureController.cs`

**Path:** `Assets/Scripts/AR/ARFurnitureGestureController.cs`

#### MOVE (1 finger)

- Activate when 1 touch moves (Began → Moved) AND `placer.PlacedInstance != null`
- If `requireTouchOnFurniture`: raycast from touch to furniture collider first
- Project touch to AR floor plane using `placer.TryGetFloorHeightAtWorldPoint`
- Update furniture XZ position; re-ground with `ARFurnitureGrounding.AlignToFloor(furniture, floorY, placer.FloorContactInset)`
- Call `placer.RefreshBlobShadowExternal()` after move ends
- Optional: `dragSmoothSpeed > 0` → Lerp position for smooth drag

#### ROTATE

- **2-finger twist:** compute angle delta between two touches around furniture pivot; apply `transform.Rotate(0, deltaAngle * rotationSensitivity, 0, Space.World)`
- Alternative: single-finger horizontal drag rotates when touch started on furniture

#### SCALE (2-finger pinch)

- Track initial pinch distance on touch Began (2 fingers)
- `scaleFactor = currentDistance / startDistance`
- Clamp against prefab's original localScale × `minScaleMultiplier` .. `maxScaleMultiplier`
- After scale, call `AlignToFloor` + refresh blob shadow

#### Input priority (critical)

```csharp
// Pseudocode
if (Touch.activeTouches.Count == 2) {
    // pinch/rotate — gesture controller owns input, block placer tap
    return;
}
if (Touch.activeTouches.Count == 1 && isDragging) {
    // move — gesture controller owns input
    return;
}
// else let ARFurniturePlacer handle tap-to-place
```

Use `Physics.Raycast` from AR camera through touch for furniture hit test.

Add **BoxCollider** or **MeshCollider (convex)** to furniture prefabs if missing.

---

### 3. Furniture rendering details

`ARFurniturePlacer` already implements placement — verify it works after wiring.

On tap when `placementIndicator.IsLockedOnFloor`:

1. Instantiate `furniturePrefab` at `CurrentPose`
2. Rotate to face camera Y (`arCamera.transform.eulerAngles.y`)
3. Gabmeister spawn: scale 0 → 110% → 100% over `spawnDuration`
4. `ARFurnitureGrounding.AlignToFloor` after bounds are valid
5. Attach blob shadow via `ARFurnitureGrounding.AttachBlobShadow`
6. Create AR anchor on hit plane
7. Fire `OnFurniturePlacedEvent` + `UnityMessageBridge.SendToApp("furniturePlaced", name)`

---

### 4. Visual polish (minimal)

- Placement indicator: flat disc/plane, semi-transparent, scales up when locked
- Hide indicator after place (`hideIndicatorAfterPlace = true`)
- Blob shadow under furniture

---

## Files to Create / Modify

| Action | File |
|--------|------|
| **CREATE** | `Assets/Scripts/AR/ARFurnitureGestureController.cs` (+ `.meta`) |
| **MODIFY** | `Assets/Scenes/SampleScene.unity` — wire all references |
| **MODIFY** | `Assets/Prefabs/TestSofa.prefab` — ensure collider for hit-test |
| **OPTIONAL DELETE** | Remove `PlacementManager` from scene (keep file or delete) |
| **OPTIONAL** | Add `ARFurnitureLighting` to Managers (exists in ARFurniture scene) |

**Do NOT modify** unrelated files (frontend, backend, WebGL bridge).

---

## Acceptance Criteria

Test on Android ARCore device or XR Simulation:

1. Launch SampleScene → AR session starts, camera feed visible
2. Point at floor → placement indicator appears and turns "locked" on valid horizontal floor
3. **Tap** → TestSofa spawns at indicator with scale-up animation, feet on floor, blob shadow visible
4. **Drag** (1 finger) → furniture slides along floor, stays grounded
5. **Pinch** (2 fingers) → furniture scales between 0.3× and 3×, stays grounded
6. **Rotate** (2-finger twist) → furniture spins on Y axis
7. **Tap empty floor** → furniture repositions to new spot
8. No console errors; no missing script warnings
9. `ARFurniture.unity` gesture controller also works (same script, scene already references it)

---

## Coding Conventions

- Match existing style in `ARFurniturePlacer.cs` (regions, XML doc comments on public API)
- Use `UnityEngine.InputSystem.EnhancedTouch` — NOT legacy `Input.touchCount` in new code
- Use `ARFurnitureGrounding` for all floor alignment — never hardcode Y offsets
- Use `FindFirstObjectByType` (Unity 6) not deprecated `FindObjectOfType`
- Keep scripts in `Assets/Scripts/AR/`

---

## Out of Scope

- React Native integration changes
- Multi-furniture inventory (single placed instance is fine for MVP)
- UI buttons for rotate/scale (gestures only)
- WebGL / SampleScene non-AR mode

---

## Suggested Commit Message

```
feat(unity): add furniture placement rendering and gesture controls to SampleScene

Wire ARFurniturePlacer + ARPlacementIndicator into SampleScene, implement
ARFurnitureGestureController for move/rotate/scale after tap-to-place.
```

---

## Short Prompt (if Antigravity has a character limit)

> In `InteriorDesignViewer`, wire `SampleScene` like `ARFurniture.unity`: add Managers with `ARFurniturePlacer`, `ARPlacementIndicator` (replace `PlacementManager`), `FurnitureCatalog`, `UnityMessageBridge`, and `FurnitureRoot`. Create missing `ARFurnitureGestureController.cs` for 1-finger move, 2-finger pinch scale, and 2-finger rotate on placed furniture. Use existing `ARFurniturePlacer` for tap-to-place with `TestSofa.prefab`. Test on Android ARCore.

---

## Related Docs in This Repo

- [UNITY_AR_SETUP_INTERIORDESIGNVIEWER.md](./UNITY_AR_SETUP_INTERIORDESIGNVIEWER.md) — step-by-step AR scene setup
- [UNITY_AR_IKEA_STYLE.md](./UNITY_AR_IKEA_STYLE.md) — IKEA-style AR architecture
- [UNITY_INTEGRATION.md](./UNITY_INTEGRATION.md) — Unity ↔ React Native integration
