# Antigravity Task: Live Height Measurement (Vertical Extrude)

> **Hand this document to Antigravity** to add IKEA-style **height measurement** to the Unity AR room measurement scene.

---

## Project

| Item | Value |
|------|-------|
| **Repo path** | `D:\project\ARInteriorDesignApp-main\InteriorDesignViewer` |
| **Unity version** | 6000.x (Unity 6) |
| **Target scene** | `Assets/Scenes/ARRoomMeasurement.unity` |
| **Stack** | AR Foundation 6.x, XR Origin (Mobile AR), Input System (Enhanced Touch), URP, TextMeshPro |

---

## Goal

Add **live vertical height measurement** matching the reference app UX (user-provided screenshot: floor base ring → vertical white line → `H = 121 cm` label → "Move aim Up to extrude Height" banner → **Finish** button).

1. User scans floor (existing scan phase) → placement indicator appears
2. User **taps floor** → locks **base point** (circular floor reticle stays at base)
3. App enters **Height Extrude** mode — banner: **"Move aim Up to extrude Height"**
4. User tilts phone upward → a **vertical white line** grows from base to current aim height
5. World-space label at top shows live value: **`H = 121 cm`** (updates every frame)
6. Upward **chevron** hint along the line (optional but preferred)
7. User taps **Finish** → locks segment, shows finalized line + label; can start another height or switch back to distance mode
8. **Undo** removes last locked height; **Clear** resets everything

**Do NOT break** existing horizontal distance measurement (`D = X cm` live preview between two floor taps).

---

## Current State (REUSE — extend, don't rewrite)

### Working distance measurement (already shipped)

| File | Role |
|------|------|
| `Assets/_App/Scripts/Measurement/MeasurementController.cs` | Tap-to-place floor points, live horizontal preview line, Single/Chained modes |
| `Assets/_App/Scripts/Measurement/MeasurementScanController.cs` | Floor scan phase before reticle |
| `Assets/_App/Scripts/Measurement/MeasurementScanOverlay.cs` | Full-screen "Move phone to start" overlay |
| `Assets/_App/Scripts/Measurement/MeasurementHUDController.cs` | HUD: status, live distance, total, Clear/Undo, mode toggle |
| `Assets/_App/Scripts/Measurement/MeasurementLabel.cs` | Billboard world-space TMP label |
| `Assets/_App/Scripts/Measurement/MeasurementVisualUtility.cs` | URP-safe LineRenderer + point materials |
| `Assets/Scripts/AR/ARPlacementIndicator.cs` | Floor reticle raycast + `IsLockedOnFloor`, `CurrentPose`, `StartTracking()` / `StopTracking()` |
| `Assets/_App/Prefabs/Measurement/` | `MeasurementPointMarker`, `MeasurementLine`, `MeasurementLabel` prefabs |
| `Assets/_App/Scripts/Editor/ARRoomMeasurementSceneFix.cs` | Menu: **AR Interior → Repair ARRoomMeasurement AR Rig** |

### Scene hierarchy (ARRoomMeasurement)

```
ARRoomMeasurement
├── XR Origin          (ARPlaneManager, ARRaycastManager, XROrigin, Camera + TrackedPoseDriver)
├── AR Session
├── PlacementIndicator (ARPlacementIndicator + cursor disc mesh)
├── Managers
│   ├── MeasurementController
│   ├── MeasurementScanController   (may be missing on older scene copies — repair menu adds it)
│   └── ARSessionStateHandler
├── MeasurementRoot    (spawned markers/lines/labels)
├── MeasurementHUD     (Canvas + MeasurementHUDController)
├── MeasurementScanOverlay
└── EventSystem
```

---

## UX / State Machine

Add a top-level **measurement type** alongside existing Single/Chained:

```csharp
public enum MeasurementTool
{
    Distance,   // existing horizontal D = X cm
    Height,     // new vertical H = X cm
}
```

### Height mode flow

```
[Scanning] → (existing MeasurementScanController)
     ↓
[Height: AwaitingBase]
     • Show floor placement indicator
     • Banner: "Point at the floor, then tap to set the base"
     • Hide Finish button
     ↓ tap on valid floor
[Height: Extruding]  ← LIVE UPDATE every frame
     • Lock base point (spawn floor marker — reuse MeasurementPointMarker)
     • Hide or freeze horizontal placement indicator at base (optional: show base ring prefab)
     • Show vertical preview line (base → top)
     • Show world label: "H = X cm"
     • Show screen banner: "Move aim Up to extrude Height"
     • Show **Finish** button (primary CTA, bottom center)
     • Height updates from camera aim (see algorithm below)
     ↓ Finish pressed OR second tap (pick one; prefer Finish button like reference)
[Height: Locked]
     • Finalize line + label (cyan/white like distance segments)
     • Add to history list for Undo
     • Return to [Height: AwaitingBase] for next height OR user switches tool
```

### Distance mode

Keep existing behavior unchanged when `MeasurementTool == Distance`.

---

## Height Calculation Algorithm (CRITICAL)

After base point `basePos` is locked on the floor:

Each frame while **Extruding**:

```csharp
// 1. Screen-center ray from AR camera
var cam = arCamera; // same ref as ARPlacementIndicator
var screenCenter = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
var ray = cam.ScreenPointToRay(screenCenter);

// 2. Vertical plane through base, facing camera (billboard plane on XZ)
var flatForward = Vector3.ProjectOnPlane(cam.transform.forward, Vector3.up);
if (flatForward.sqrMagnitude < 0.0001f)
    flatForward = cam.transform.forward; // looking straight up/down fallback
flatForward.Normalize();

var verticalPlane = new Plane(flatForward, basePos);

// 3. Intersect ray with plane → aim point
if (!verticalPlane.Raycast(ray, out float enter))
    return; // keep last height

var aimPoint = ray.GetPoint(enter);

// 4. Height = vertical component only (world Y), clamped
float heightMeters = Mathf.Max(0f, aimPoint.y - basePos.y);

// Optional clamp for sanity
heightMeters = Mathf.Min(heightMeters, 6f); // max 6 m ceiling
```

**Top world position** for line + label:

```csharp
var topPos = basePos + Vector3.up * heightMeters;
```

**Why this works:** As the user tilts the phone up, the center ray hits higher on the vertical plane through the base — same feel as the reference "extrude" interaction. The line stays **perfectly vertical** (world Y), not slanted.

**Do NOT** use horizontal floor raycast for the top point during extrude — that would keep height near zero when aiming at walls.

---

## Visual Spec (match reference)

| Element | Spec |
|---------|------|
| **Base marker** | Reuse `MeasurementPointMarker.prefab` at floor; optional: flat disc ring (purple tint) at base — can duplicate placement indicator mesh scaled down |
| **Vertical line** | `LineRenderer`, 2 positions: `basePos + up*inset` → `topPos + up*inset`; white, `previewLineWidth` while live; locked color after Finish |
| **Live label** | `MeasurementLabel.prefab` at `topPos + up*0.04f`; text format **`H = {cm} cm`** or **`H = {m} m`** if ≥ 1 m |
| **Up chevron** | Optional `Image` or simple mesh billboard at ~30% along line, semi-transparent white, rotates to face camera |
| **Screen banner** | TMP top-center dark pill: `"Move aim Up to extrude Height"` — only visible during Extruding |
| **Finish button** | Large purple/blue pill, bottom center, hidden until Extruding |

### Label format helpers

Add to `MeasurementController` (or shared static util):

```csharp
public static string FormatHeightLive(float meters)
{
    if (meters >= 1f)
        return $"H = {meters:F2} m";
    return $"H = {meters * 100f:F0} cm";
}
```

Distance labels keep `FormatLive()` → `D = X cm`.

---

## Implementation Plan

### Option A (preferred): Extend `MeasurementController`

Keep one controller on Managers; add height state + preview objects.

**New serialized fields:**

```csharp
[Header("Height measurement")]
[SerializeField] private float maxHeightMeters = 6f;
[SerializeField] private GameObject heightChevronPrefab; // optional
```

**New runtime state:**

```csharp
MeasurementTool activeTool = MeasurementTool.Distance;
enum HeightPhase { Idle, AwaitingBase, Extruding }
HeightPhase heightPhase;
Vector3 heightBasePos;
GameObject heightPreviewLine;
GameObject heightPreviewLabel;
MeasurementLabel heightPreviewLabelComponent;
float liveHeightMeters;
readonly List<HeightSegment> heightSegments; // line, label, heightMeters
```

**New events** (for HUD):

```csharp
public event Action<float> OnLiveHeightChanged;
public event Action<MeasurementTool> OnToolChanged;
public event Action<HeightPhase> OnHeightPhaseChanged;
public bool IsHeightExtruding => activeTool == MeasurementTool.Height && heightPhase == HeightPhase.Extruding;
```

**Update loop:**

```csharp
void Update()
{
    if (activeTool == MeasurementTool.Distance)
    {
        UpdateLivePreview(); // existing
        HandleDistanceTap();
    }
    else
    {
        UpdateHeightExtrude();
        HandleHeightTap(); // base tap only when AwaitingBase
    }
}
```

**On tool switch:** `ClearAll()` + reset height phase; restart placement indicator if scan complete.

### Option B: Separate `MeasurementHeightController`

Only if `MeasurementController` becomes too large (>600 lines). If so, share visuals via `MeasurementVisualUtility` and coordinate through `MeasurementHUDController`.

---

## HUD Changes (`MeasurementHUDController`)

Add UI wired in `ARRoomMeasurementSceneFix.CreateMeasurementHud` + repair menu:

| Control | Behavior |
|---------|----------|
| **Tool toggle** | Segmented control or second toggle: `Distance` \| `Height` |
| **Height banner** | `heightInstructionText` — visible only during Extruding |
| **Finish button** | `finishHeightButton` — visible only during Extruding; calls `measurementController.FinishHeightMeasurement()` |
| **Live height text** | Screen-space duplicate optional; primary value is world-space label on line top |
| **Existing live distance** | Hide when `activeTool == Height` |
| **Undo** | In Height mode: undo last finalized height segment (or cancel extrude if mid-extrude) |
| **Clear** | Clears both distance and height data |

Subscribe to new events in `OnEnable` / unsubscribe in `OnDisable`.

Update `ARRoomMeasurementSceneFix.cs` to create Finish button + tool toggle when building HUD.

---

## New / Modified Files

| Action | File |
|--------|------|
| **MODIFY** | `Assets/_App/Scripts/Measurement/MeasurementController.cs` — height tool, extrude logic, Finish/Undo |
| **MODIFY** | `Assets/_App/Scripts/Measurement/MeasurementHUDController.cs` — tool toggle, Finish, height banner |
| **MODIFY** | `Assets/_App/Scripts/Editor/ARRoomMeasurementSceneFix.cs` — HUD wiring for new controls |
| **OPTIONAL CREATE** | `Assets/_App/Prefabs/Measurement/HeightChevron.prefab` — upward arrow billboard |
| **OPTIONAL MODIFY** | `Assets/_App/Scripts/Measurement/MeasurementVisualUtility.cs` — add `ConfigureVerticalLine()` if floor inset logic differs |
| **MODIFY** | `Assets/Scenes/ARRoomMeasurement.unity` — wire new HUD refs (or run Repair menu) |

**Do NOT modify** frontend, backend, or `Assets/Scripts/AR/ARPlacementIndicator.cs` unless adding a tiny public helper (prefer keeping height math in measurement scripts).

---

## Interaction Details

### Input

- Use **Input System** (`Touchscreen.current`) — same pattern as `TryConsumeTap()` in `MeasurementController`
- Ignore taps over UI (`EventSystem.current.IsPointerOverGameObject`)
- **Finish** is a UI Button — no screen tap needed to confirm

### Placement indicator during height

| Phase | Indicator |
|-------|-----------|
| AwaitingBase | `StartTracking()` — normal floor reticle |
| Extruding | `StopTracking()` — base marker shows locked point; vertical line replaces reticle |
| After Finish | `StartTracking()` again for next base |

### Coexistence with scan phase

```csharp
if (scanController != null && !scanController.IsScanComplete)
    return; // block height taps and extrude
```

---

## Acceptance Criteria

Test on **Android ARCore device** (build APK with phone unplugged if Unity OpenGL check fails — use **AR Interior → Build Android APK (No Device Check)**):

1. Launch `ARRoomMeasurement` → floor scan completes → reticle appears
2. Switch HUD to **Height** tool
3. Tap floor → base marker spawns, banner shows **"Move aim Up to extrude Height"**, **Finish** button appears
4. Tilt phone up slowly → vertical white line grows; label shows **`H = X cm`** updating live (e.g. 80 cm → 121 cm)
5. Line stays **vertical** (parallel to world Y) from base
6. Tap **Finish** → line/label lock; value stays on screen
7. Tap **Undo** → removes last height measurement
8. Switch to **Distance** tool → horizontal `D = X cm` live preview still works as before
9. **Clear** resets both tools
10. No console errors; no missing script warnings

---

## Coding Conventions

- Match style in `MeasurementController.cs` — minimal comments, reuse `MeasurementVisualUtility`, `MeasurementLabel`, existing prefabs
- Use `FindFirstObjectByType` (Unity 6), not deprecated APIs
- Use `ARPlacementIndicator` type (not `PlacementIndicator` subclass) for serialized refs
- Keep scripts in `Assets/_App/Scripts/Measurement/`
- Editor menus stay in `Assets/_App/Scripts/Editor/`

---

## Out of Scope

- React Native bridge (`roomMeasured` JSON) — separate task
- Measuring height without a floor tap (auto-detect) 
- Multiple simultaneous height lines
- Wall-plane height (point-to-point on vertical surfaces) — only vertical extrude from floor base
- WebGL

---

## Suggested Commit Message

```
feat(unity): add live vertical height measurement to ARRoomMeasurement

Extrude-style H = X cm from a floor base point with Finish confirmation,
tool toggle between distance and height, and HUD updates. Reuses measurement
prefabs and visual utility.
```

---

## Short Prompt (if Antigravity has a character limit)

> In `InteriorDesignViewer/Assets/Scenes/ARRoomMeasurement.unity`, extend `MeasurementController` with a **Height** tool: tap floor for base, tilt phone up to live-extrude a vertical white line and world label `H = X cm` (ray vs vertical plane through base), confirm with a **Finish** button and banner "Move aim Up to extrude Height". Update `MeasurementHUDController` + `ARRoomMeasurementSceneFix` for Distance/Height toggle and Finish. Keep existing horizontal `D = X cm` distance measurement working. Test on Android ARCore.

---

## Related Docs

- [ANTIGRAVITY_SAMPLESCENE_FURNITURE_GESTURES.md](./ANTIGRAVITY_SAMPLESCENE_FURNITURE_GESTURES.md) — Antigravity prompt format reference
- [UNITY_INTEGRATION.md](./UNITY_INTEGRATION.md) — Unity ↔ React Native (future `roomMeasured` payload)
