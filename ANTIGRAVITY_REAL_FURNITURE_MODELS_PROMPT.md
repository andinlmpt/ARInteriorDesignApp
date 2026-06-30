# Antigravity Prompt: Replace Geometry Furniture With Real 3D Models

## Problem (Current Behavior — UNACCEPTABLE)

Furniture in AR View renders as **primitive geometry**, not real furniture:

- Flat colored **boxes** and stacked `BoxGeometry` shapes (procedural fallback)
- **Green wireframe** bounding boxes during drag (looks like a debug mesh, not furniture)
- Solid flat colors with no wood/fabric/metal textures
- No realistic materials (PBR), normal maps, or proper lighting response

**This is what we see today** — a green wireframe table over the camera feed. Users cannot judge how furniture will look in their room.

## Required Outcome (What “Real Furniture” Means)

Every placed item must be a **photorealistic or near-photorealistic 3D asset**:

| Requirement | Detail |
|-------------|--------|
| **Asset format** | `.glb` / `.gltf` with embedded or referenced textures |
| **Materials** | `MeshStandardMaterial` or glTF PBR (roughness, metalness, base color map) |
| **Appearance** | Recognizable sofa, table, chair — legs, cushions, wood grain, fabric, etc. |
| **Scale** | Normalized to `dimensions` in meters (width × length × height) |
| **Placement** | Bottom of model on floor plane; no floating |
| **Drag preview** | Semi-transparent **clone of the real model** — **NOT** wireframe box |
| **Fallback** | If GLB fails: show error + retry — **do NOT** silently show colored boxes in production |

---

## Root Cause in This Codebase

1. **`FurnitureModelLoader.createProceduralFurnitureModel()`** builds furniture from `BoxGeometry` primitives when GLB is missing or fails.
2. **`model3D.url` is empty** on most items in `constants/furniture-library.ts`.
3. **`FURNITURE_MODEL_URLS`** in `FurnitureModelLoader.ts` are empty strings — remote load always fails.
4. **No `.glb` files** exist under `frontend/assets/models/` yet.
5. **Drag ghost** in `hooks/ar-view/useARViewSceneGestures.ts` uses `wireframe: true` on a box — causes the green wireframe look.

---

## Your Task

Transform AR furniture rendering from **geometry-based placeholders** to **real GLB models**.

### 1. Add real 3D model files (MANDATORY)

Create and commit GLB assets:

```
frontend/assets/models/furniture/
├── sofa-modern.glb
├── coffee-table.glb
├── accent-chair.glb
├── dining-table.glb
├── bookshelf.glb
└── ...
```

**Model sources (CC0 / free commercial use):**
- [Poly Haven](https://polyhaven.com/models) — high quality, CC0
- [Khronos glTF Sample Models](https://github.com/KhronosGroup/glTF-Sample-Models) — for testing only
- [Sketchfab](https://sketchfab.com) — filter CC0 / CC-BY

**Model requirements:**
- Low–medium poly (< 50k triangles per item) for mobile
- File size < 5 MB per model preferred
- Y-up, centered origin; loader will scale to catalog dimensions

### 2. Wire models to the furniture library

Update `frontend/constants/furniture-library.ts`:

```typescript
{
  id: 'coffee-table',
  name: 'Coffee Table',
  category: 'tables',
  dimensions: { width: 1.0, length: 0.6, height: 0.42 },
  color: '#14B8A6',
  model3D: {
    url: require('@/assets/models/furniture/coffee-table.glb'),
    format: 'glb',
    scale: 1.0,
  },
},
```

Ensure `FurnitureLibraryItem.model3D.url` accepts `number` (asset module id from `require()`).

### 3. Fix `FurnitureModelLoader.ts`

- **Primary path:** `item.model3D` → `loadGLBModel()` → scale to `dimensions` → center → floor-align.
- **Bundled assets:** `Asset.fromModule(require(...))` (partially implemented — verify end-to-end).
- **Disable or gate procedural fallback:**
  - `__DEV__` only: allow procedural for debugging
  - Production: log error, show user-facing “Model failed to load” — no silent boxes
- Remove empty `FURNITURE_MODEL_URLS` placeholders or replace with real hosted URLs.
- After load, traverse mesh and ensure:
  ```typescript
  child.castShadow = true;
  child.receiveShadow = true;
  if (child.material instanceof THREE.MeshStandardMaterial) {
    child.material.needsUpdate = true;
  }
  ```

### 4. Remove wireframe / box drag ghost

In `hooks/ar-view/useARViewSceneGestures.ts`, replace drag ghost creation:

**REMOVE:**
```typescript
ghostGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
ghostMaterial = new THREE.MeshStandardMaterial({ wireframe: true, ... });
```

**REPLACE WITH:**
- Clone the placed furniture `Group` (or reload same GLB)
- Apply `opacity: 0.4`, `transparent: true`
- **No wireframe**
- Optional: slight blue tint only on edges, not full wireframe box

### 5. Improve lighting for realistic materials

In `hooks/useARRenderer.ts`, ensure PBR materials look correct:

- `renderer.outputColorSpace = THREE.SRGBColorSpace` (already set)
- Ambient + directional + fill lights (already present — tune intensity)
- `MeshStandardMaterial` needs adequate light — avoid flat unlit appearance
- Optional: `environment` map or hemisphere light for subtle reflections

### 6. Preview ghost (before placement)

In `useARRenderer.ts`, when user selects a library item:

- Load same GLB via `furnitureModelLoader.createDetailedFurnitureModel()`
- Show semi-transparent preview at reticle — **real mesh shape**, not a box

### 7. Safety coloring (optional polish)

Green/red emissive on **entire mesh** during drag is OK for feedback, but:
- Base mesh must remain the **real GLB** underneath
- Do not replace geometry with colored boxes for safety states
- Prefer subtle emissive tint (`emissiveIntensity: 0.15`) not full flat green

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/assets/models/furniture/*.glb` | **ADD** real models |
| `frontend/constants/furniture-library.ts` | `model3D.url: require(...)` per item |
| `frontend/services/FurnitureModelLoader.ts` | GLB-first; disable silent procedural fallback |
| `frontend/types/ar-view.ts` | `model3D.url: string \| number` if needed |
| `frontend/hooks/ar-view/useARViewSceneGestures.ts` | Real-model drag ghost, no wireframe |
| `frontend/hooks/useARRenderer.ts` | Real-model preview ghost |
| `frontend/metro.config.js` | Ensure `.glb` in `assetExts` |

## Files NOT to Use for Final Rendering

- `createProceduralFurnitureModel()` — dev/debug only after this task
- `createBoxFallback()` — remove from user-facing path
- Remote placeholder CDN URLs that 404

---

## Acceptance Criteria (Visual)

Before/after must be obvious:

| Before (reject) | After (required) |
|-----------------|------------------|
| Green wireframe box | Textured table with legs and wood top |
| Flat green/blue solid color blocks | Sofa with cushions, fabric, legs |
| Primitive stacked boxes | Chair with backrest and arm geometry from GLB |
| “Move to reposition” on wireframe | Same real model, slightly transparent while dragging |

**Test on physical Android/iOS device** with dev client build.

---

## Implementation Order

1. Download/create 3 GLBs: sofa, coffee table, accent chair  
2. Add to `assets/models/furniture/`  
3. Wire `require()` in `furniture-library.ts`  
4. Verify `loadGLBModel` loads bundled assets on device  
5. Remove wireframe drag ghost → use model clone  
6. Add preview ghost with real GLB  
7. Gate procedural fallback to `__DEV__` only  
8. Expand to full catalog  

---

## Copy-Paste Instruction for Antigravity

```
Read ANTIGRAVITY_REAL_FURNITURE_MODELS_PROMPT.md and implement it fully.

Goal: Stop rendering furniture as geometry primitives and wireframe boxes.
Every placed item must use real .glb 3D models with PBR materials and textures.

Priority:
1) Add GLB files to frontend/assets/models/furniture/
2) Wire model3D in furniture-library.ts
3) Fix FurnitureModelLoader to load bundled GLBs and scale to dimensions
4) Remove wireframe box drag ghost in useARViewSceneGestures.ts
5) Disable silent procedural/box fallback in production

Do not rebuild AR from scratch. Use existing hooks in hooks/ar-view/ and FurnitureModelLoader.
```

---

## Reference

- Broader AR flow: `ANTIGRAVITY_AR_FURNITURE_VISUALIZATION_PROMPT.md`
- Native AR (later): `ANTIGRAVITY_AR_NATIVE_PROMPT.md`
- Project rules: `.cursor/rules/ar-interior-design-app.mdc`
