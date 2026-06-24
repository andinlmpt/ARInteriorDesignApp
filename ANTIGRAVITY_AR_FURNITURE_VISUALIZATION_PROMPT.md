# Antigravity Prompt: AR Furniture Visualization (3D Models in Room)

Act as a senior React Native / Expo / Three.js developer working on **AR Interior Design App**. Your job is to deliver a **working AR furniture visualization feature** so users can see **3D furniture models in their real room** and decide if pieces fit their space.

---

## Product Goal (User Story)

> As a user, I open AR View, point my phone at my room, pick a sofa/table/chair from the library, place it on the floor, move and rotate it, and judge whether it looks good before buying or designing.

**Success criteria:**
- Live camera background with 3D furniture rendered on top
- Furniture appears at correct real-world scale (meters)
- User can place, move, rotate, and remove items
- Models look like furniture (GLB preferred; procedural fallback OK)
- Works on **Android + iOS** dev builds; graceful fallback on unsupported devices/web

---

## Is This Achievable?

**Yes — in phases.**

| Phase | What | Feasibility | Notes |
|-------|------|-------------|-------|
| **A — Preview AR (now)** | Camera + transparent Three.js overlay, tap-to-place, drag/rotate | ✅ **Already ~80% built** | Not true world tracking; furniture stays in screen space as user moves phone |
| **B — Real 3D models** | Load `.glb` assets per library item, scale to dimensions | ✅ **Achievable in days** | `FurnitureModelLoader` + `model3D` on library items; host assets in `frontend/assets/models/` |
| **C — Polish** | Preview ghost, unified entry screen, save layout | ✅ **Achievable** | Refactored hooks/components ready for extension |
| **D — Native AR** | ARKit / ARCore plane lock, stable anchors | ⚠️ **Achievable but larger** | Needs `expo prebuild`, dev client, native bridge completion — see `ANTIGRAVITY_AR_NATIVE_PROMPT.md` |

**Recommendation for Antigravity:** Ship **Phase A + B + C** first (user-visible 3D furniture in room). Treat **Phase D** as follow-up unless native modules are already implemented.

---

## Current Codebase (Do Not Ignore)

### Monorepo layout
- **Frontend:** `frontend/` — Expo SDK 54, React Native 0.81, TypeScript, Expo Router
- **Backend:** `backend/` — not required for AR rendering

### AR routes (important)
| Route | File | Status |
|-------|------|--------|
| `/ar-view` | `frontend/app/ar-view.tsx` → `components/ar-view/ARViewScreen.tsx` | **Full studio** — library, placement, gestures, collision, history |
| `/ar-furniture` | `frontend/app/ar-furniture.tsx` | **Simple demo** — 3 items, used from Home/Camera tab today |

**Task:** Unify navigation so users land on **`/ar-view`** (or merge `ar-furniture` into it).

### Refactored AR View modules (use these — do not bloat `ARViewScreen.tsx` again)

```
frontend/
├── app/ar-view.tsx                          # Thin route entry
├── components/ar-view/
│   ├── ARViewScreen.tsx                     # Orchestrator (~3.3k lines — extract UI further if needed)
│   ├── ARViewViewport.tsx                   # CameraView + GLView overlay
│   ├── ARViewPermissionGate.tsx
│   └── ARViewErrorBoundary.tsx
├── hooks/ar-view/
│   ├── useARViewFurniturePlacement.ts       # addFurnitureToScene, remove, restore, collisions
│   ├── useARViewSceneGestures.ts            # tap, pan, drag, rotate, snap
│   ├── useARViewMeasurementVisualization.ts
│   └── useARViewBottomSheet.ts
├── hooks/useARRenderer.ts                   # Three.js scene, reticle, render loop
├── services/FurnitureModelLoader.ts         # GLB load + procedural fallback
├── constants/furniture-library.ts           # Furniture catalog (add model3D here)
├── utils/arViewFurnitureLibrary.ts
└── styles/arView.styles.ts
```

### How rendering works today

1. `CameraView` (`expo-camera`) — live room background  
2. `GLView` (`expo-gl`) — transparent WebGL layer  
3. `useARRenderer` — scene, lights, reticle, animation loop  
4. `useARViewFurniturePlacement` → `furnitureModelLoader.createDetailedFurnitureModel()`  
5. User taps → `useARViewSceneGestures.handleSceneTap` → `addFurnitureToScene(position)`

### Model loading priority (`FurnitureModelLoader`)

1. `item.model3D.url` on library item (GLB/GLTF) — **preferred, not wired for most items yet**  
2. `MODEL_CONFIGS` remote URLs — placeholders, often fail  
3. **Procedural geometry** by category — **default today** (boxes/sofa shapes)

---

## What Antigravity Must Build

### 1. Real 3D furniture models (Priority: HIGH)

- Add GLB files under `frontend/assets/models/furniture/` (e.g. `sofa-modern.glb`, `coffee-table.glb`)
- Register in `metro.config.js` if needed for `.glb` assets
- Update `frontend/constants/furniture-library.ts`:

```typescript
{
  id: 'sofa-modern',
  name: 'Modern Sofa',
  category: 'seating',
  dimensions: { width: 2.1, length: 0.95, height: 0.85 },
  color: '#2563EB',
  model3D: {
    url: require('@/assets/models/furniture/sofa-modern.glb'), // or bundled URI
    format: 'glb',
    scale: 1.0,
  },
}
```

- Ensure `FurnitureModelLoader.loadGLBModel` handles **local bundled assets** (not only remote URLs)
- Normalize: scale to `dimensions`, center mesh, bottom on floor (Y = height/2)
- Keep procedural fallback if load fails

### 2. Placement UX (Priority: HIGH)

- Wire **preview ghost** in `useARRenderer` to show selected item before tap (call `createDetailedFurnitureModel` when `selectedLibraryItem` changes)
- Reticle on floor + “Tap to place” hint (mostly exists)
- After place: haptic + subtle scale-in animation (exists in placement hook)

### 3. Manipulation (Priority: MEDIUM)

Already in `useARViewSceneGestures`:
- One finger drag to move  
- Two finger rotate  
- Tap to select placed item  
- Collision/safety coloring (optional polish)

Verify these work after model switch from boxes to GLB groups.

### 4. Navigation & entry (Priority: HIGH)

- Change `frontend/app/(tabs)/index.tsx` and `frontend/app/(tabs)/camera.tsx` to route to **`/ar-view`** instead of `/ar-furniture`
- Deprecate or thin-wrap `ar-furniture.tsx` → redirect to `ar-view`

### 5. Permissions & fallback (Priority: MEDIUM)

- Camera permission gate — `ARViewPermissionGate` (exists)
- If WebGL/Three fails → show message + optional non-AR preview mode
- Web: camera may work; AR depth limited — document as preview-only

### 6. Native AR (Priority: LOW for first delivery)

- Stub exists: `frontend/native/ARSessionNative.ts` (no native implementation yet)
- For v1, **do not block** on ARCore/ARKit
- If implementing native later, follow `ANTIGRAVITY_AR_NATIVE_PROMPT.md` — keep preview mode as fallback

---

## Technical Constraints

- Use **`@/`** path alias for imports  
- Use **`useTheme()`** for colors — no hardcoded theme colors in new UI  
- Use existing hooks/services — **do not** add a second parallel AR stack  
- Follow decomposition: new logic → `hooks/ar-view/`, new UI → `components/ar-view/`  
- Do **not** grow `ARViewScreen.tsx` back into a 6k-line monolith  
- `expo-three` is **not** in dependencies — use `three` + `expo-gl` directly  
- Test on **development build** (`expo-dev-client`), not only Expo Go, if using native AR later  

---

## Files You May Modify

| File | Action |
|------|--------|
| `constants/furniture-library.ts` | Add `model3D` per item |
| `services/FurnitureModelLoader.ts` | Local asset loading, cache, normalization |
| `hooks/useARRenderer.ts` | Preview ghost mesh from selected library item |
| `hooks/ar-view/useARViewFurniturePlacement.ts` | Minor fixes for Group vs Mesh |
| `app/(tabs)/index.tsx`, `camera.tsx` | Route to `/ar-view` |
| `assets/models/furniture/*.glb` | Add model files |
| `metro.config.js` | Ensure `.glb` resolves |

## Files to Avoid Rewriting

- Entire `ARViewScreen.tsx` from scratch  
- Duplicate of `ARFurniturePlacement.tsx` logic (merge into ar-view flow instead)

---

## Acceptance Tests

1. Open app → AR View → grant camera → see live room  
2. Open furniture library bottom sheet → select sofa  
3. See preview ghost / reticle on floor  
4. Tap → **3D sofa model** appears (not plain box if GLB provided)  
5. Drag to reposition; two-finger rotate  
6. Place second item; both visible and selectable  
7. Remove item or clear scene  
8. Kill network → local bundled GLB still loads  
9. Android + iOS physical device smoke test  

---

## Suggested Implementation Order

1. Inspect `FurnitureModelLoader` + one library item end-to-end  
2. Add 2–3 local GLB models + `model3D` config  
3. Fix local asset path loading in loader  
4. Route all AR entry points to `/ar-view`  
5. Implement preview ghost in `useARRenderer`  
6. Test place/move/rotate on device  
7. Extract `ARViewFurnitureBottomSheet.tsx` if time permits (optional)  
8. Native AR only if Phase A–C pass acceptance tests  

---

## Demo Script (for stakeholder)

> "Point your phone at the room, pick furniture from the library, and place true-to-scale 3D models on your floor. Move and rotate pieces to see how they look in your space before you commit to a design."

---

## Reference Docs in Repo

- `ANTIGRAVITY_AR_NATIVE_PROMPT.md` — Native ARKit/ARCore (phase D)  
- `frontend/QUICK_START_3D_MODELS.md` — Model hosting options  
- `docs/3D_MODELS_GUIDE.md` — Asset pipeline (if present)  
- `.cursor/rules/ar-interior-design-app.mdc` — Project conventions  

---

**Start by reading:** `components/ar-view/ARViewScreen.tsx`, `hooks/ar-view/useARViewFurniturePlacement.ts`, `services/FurnitureModelLoader.ts`, `constants/furniture-library.ts`

**Deliverable:** Working `/ar-view` with at least 3 furniture items rendering as **GLB 3D models** on the camera feed, placeable and movable in the room.
