# Antigravity Prompt: Port Spatial Mapping from `shi-ningning/ARInteriorDesignApp`

Act as a senior React Native / Expo / computer-vision developer working on **AR Interior Design App**. Your job is to **analyze the GitHub repo** [shi-ningning/ARInteriorDesignApp](https://github.com/shi-ningning/ARInteriorDesignApp.git), **identify only spatial-mapping-related code**, and **selectively port improvements** into the user's local codebase at `d:\project\ARInteriorDesignApp-main` — **without** bringing over unrelated features (AR furniture UI, Groq/Gemini AI, theme recommend, auth, etc.).

---

## Product Goal (User Story)

> As a user, I scan my room (camera or photo), get accurate dimensions, detected walls/obstacles, a 2D floor plan, and optional live depth mapping — then pass that `roomData` into AR View or AI Design.

**Success criteria:**
- `/spatial-mapping` and `/live-scan` work end-to-end on device
- Room dimensions, obstacles, planes, and confidence scores are produced reliably
- Floor plan visualization reflects scan results
- Scan data can export (JSON/CSV) and navigate to AR View with `roomDataJson` param
- **Only spatial-mapping scope** is changed — AR View (`ARViewScreen`), Groq backend, and theme screens stay intact

---

## Source Repository

| Item | Value |
|------|-------|
| **Remote URL** | `https://github.com/shi-ningning/ARInteriorDesignApp.git` |
| **Branches** (known) | `main`, `aldrin`, `baste` |
| **Local target** | `d:\project\ARInteriorDesignApp-main` |
| **Local branch** | Start from `main` or `integrate/groq-943203f` — create `integrate/spatial-mapping-shi` |

**Important:** This repo may be large or slow to clone. Use a **shallow clone** for analysis only. Do **not** replace the entire local project with the remote repo.

---

## Step 0 — Clone & Discover (Do This First)

```powershell
# Analysis clone (outside main project)
cd $env:TEMP
git clone --depth 1 --branch main https://github.com/shi-ningning/ARInteriorDesignApp.git shi-ningning-analysis

# If main is empty or stale, try team branches:
# git clone --depth 1 --branch aldrin https://github.com/shi-ningning/ARInteriorDesignApp.git shi-ningning-analysis
# git clone --depth 1 --branch baste  https://github.com/shi-ningning/ARInteriorDesignApp.git shi-ningning-analysis
```

### Find all spatial-mapping files in the source repo

```powershell
cd $env:TEMP\shi-ningning-analysis

# Filename search
Get-ChildItem -Recurse -Include "*spatial*","*Spatial*","*live-scan*","*LiveScan*","*depth*","*Depth*","*plane*","*Plane*","*room*scan*" |
  Where-Object { $_.FullName -notmatch 'node_modules|\.git' } |
  Select-Object -ExpandProperty FullName

# Content search (PowerShell)
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js -File |
  Where-Object { $_.FullName -notmatch 'node_modules|\.git' } |
  Select-String -Pattern "SpatialMapping|spatial-mapping|live-scan|DepthEstimation|ARPlane|plane detection|roomData" -List |
  Select-Object -ExpandProperty Path
```

### Compare file-by-file with local

```powershell
cd d:\project\ARInteriorDesignApp-main

# Local spatial inventory
Get-ChildItem -Recurse -Include "*spatial*","*Spatial*","*live-scan*","*LiveScan*" frontend |
  Where-Object { $_.FullName -notmatch 'node_modules' }
```

For each file found in **both** repos, run:

```powershell
# Example diff (adjust paths after discovery)
git diff --no-index `
  "$env:TEMP\shi-ningning-analysis\frontend\services\SpatialMappingService.ts" `
  "d:\project\ARInteriorDesignApp-main\frontend\services\SpatialMappingService.ts"
```

Create a working branch in the **target** repo:

```powershell
cd d:\project\ARInteriorDesignApp-main
git checkout -b integrate/spatial-mapping-shi
```

---

## What Counts as "Spatial Mapping" (IN SCOPE)

Port **only** code related to:

| Feature | Keywords / paths |
|---------|------------------|
| Room scanning UI | `spatial-mapping.tsx`, `live-scan.tsx` |
| Scan hooks | `useSpatialMapping*`, `useLiveScan*` |
| Mapping services | `SpatialMappingService`, `EnhancedSpatialMappingService`, `SpatialMappingOutputService` |
| Depth / planes | `DepthEstimationService`, `ARPlane`, `native/ARPlane`, plane detection |
| Image → room analysis | `ImageAnalysisService`, `EnhancedImageAnalysisService` (if used by scan flow only) |
| Floor plan UI | `FloorPlanVisualization`, `components/spatial-mapping/*` |
| Types & config | `types/spatial-mapping*.ts`, `spatialMapping.config.ts`, `liveScan.config.ts` |
| Helpers | `spatialMappingHelpers.ts`, `liveScanHelpers.ts` |
| Room layout from scan | `RoomLayoutService` (if tied to mapping output) |
| Navigation to AR with room data | params like `roomDataJson`, `imageUri` |

### Backend (only if source has spatial-specific APIs)

| Feature | Paths |
|---------|-------|
| Spatial mapping persistence | `spatial_mappings` routes/models/controllers |
| Layout from scan data | `layoutController` **only** if it consumes `RoomData` / scan output |

---

## What is OUT OF SCOPE (Do NOT Port)

| Area | Why skip |
|------|----------|
| AR furniture placement | Local uses `ARViewScreen` + `hooks/ar-view/*` — separate prompt |
| Groq / Gemini / AI design | Already integrated on `integrate/groq-943203f` |
| Theme recommend, explore, profile | Unrelated |
| Auth, projects CRUD (unless scan save requires it) | Port only minimal scan-save if missing locally |
| Full `ar-view.tsx` / Manager hooks from other forks | Do not replace local AR stack |
| `package.json` dependency upgrades | Only add deps **required** by ported spatial code |
| Replacing entire `frontend/` or `backend/` | Selective port only |

---

## Current Local Codebase (Baseline — Read Before Porting)

The local app **already has** a modular spatial-mapping stack. Antigravity must **extend or fix** it, not duplicate parallel systems.

### Routes

| Route | File | Purpose |
|-------|------|---------|
| `/spatial-mapping` | `frontend/app/spatial-mapping.tsx` | Photo/calibration scan, floor plan, export |
| `/live-scan` | `frontend/app/live-scan.tsx` | Real-time camera scanning |

Registered in `frontend/config/navigation.config.ts`.

### Hooks (`frontend/hooks/`)

```
useSpatialMappingScan.ts       # Scan lifecycle, history, professional report
useSpatialMappingCalibration.ts
useSpatialMappingMeasurement.ts
useSpatialMappingUI.ts
useLiveScanCamera.ts
useLiveScanProcessing.ts
```

### Services (`frontend/services/`)

```
SpatialMappingService.ts           # Core mapping — plane detection is SIMULATED today
EnhancedSpatialMappingService.ts   # 3D map, heatmap, FPS, calibration
SpatialMappingOutputService.ts     # Export / output formatting
DepthEstimationService.ts
ImageAnalysisService.ts
EnhancedImageAnalysisService.ts
RoomLayoutService.ts
```

**Known gap (local):** `SpatialMappingService.processFrame()` uses simulated plane detection. Comments say production should use ARKit/ARCore. **Priority:** port any **real** plane/depth logic from shi-ningning if present.

### Components (`frontend/components/spatial-mapping/`)

```
FloorPlanVisualization.tsx
ScanProgressView.tsx
CalibrationModal.tsx
index.ts
```

### Types & config

```
frontend/types/spatial-mapping.ts
frontend/types/spatial-mapping-ui.ts
frontend/types/live-scan.ts
frontend/config/spatialMapping.config.ts
frontend/config/liveScan.config.ts
frontend/utils/spatialMappingHelpers.ts
frontend/utils/liveScanHelpers.ts
```

### AR integration (touch only if needed)

- `frontend/app/ar-view.tsx` → `ARViewScreen` accepts `roomDataJson` search param
- `frontend/hooks/ar-view/useARViewFurniturePlacement.ts` — uses room/obstacle data for placement
- `frontend/native/ARPlane.ts` — native plane stub

### Docs (reference)

- `docs/HOW_THE_SYSTEM_WORKS.md` — spatial reasoning flow
- `docs/MONGODB_DOCUMENT_MODEL.md` — `spatial_mappings` collection schema
- `docs/IMPROVEMENT_SUGGESTIONS.md` — plane detection TODO

---

## Recommended Port Strategy

### Phase 1 — Analysis report (no code yet)

1. List every spatial file in shi-ningning repo (paths + line counts).
2. Mark each as: **new**, **better than local**, **same**, **worse/legacy**.
3. Identify the **best branch** (`main` vs `aldrin` vs `baste`) for spatial code.
4. Deliver a short table: `source path → local path → action (port / skip / merge logic)`.

### Phase 2 — Port high-value gaps

Priority order:

1. **Real plane / depth detection** (replace simulation in `SpatialMappingService`)
2. **Live scan processing** improvements (`useLiveScanProcessing`, camera frame pipeline)
3. **Floor plan accuracy** (`FloorPlanVisualization`, wall boundary logic)
4. **Calibration** (`CalibrationModal`, `useSpatialMappingCalibration`)
5. **Export / professional report** (if source has richer output)
6. **Backend spatial_mappings API** (only if source persists scans and local lacks it)

### Phase 3 — Integrate without breaking AR

- Keep `RoomData` / `SpatialMappingResult` types in `frontend/types/spatial-mapping.ts` — extend, don't fork duplicate types.
- Pass scan results to AR via existing pattern:

```typescript
router.push({
  pathname: '/ar-view',
  params: { roomDataJson: JSON.stringify(roomData) },
});
```

- Do **not** rewrite `ARViewScreen.tsx` unless a spatial type import forces a small fix.

### Phase 4 — Verify & commit

See Acceptance Tests below.

---

## How to Extract a Single File from Source Repo

```powershell
# Copy one file for manual merge
Copy-Item "$env:TEMP\shi-ningning-analysis\frontend\services\SpatialMappingService.ts" `
  "$env:TEMP\SpatialMappingService.shi.ts"

# Or use git show if you added source as remote:
cd d:\project\ARInteriorDesignApp-main
git remote add shi-ningning https://github.com/shi-ningning/ARInteriorDesignApp.git
git fetch shi-ningning --depth 1
git show shi-ningning/main:frontend/services/SpatialMappingService.ts
```

---

## Conflict Decision Matrix

| Scenario | Resolution |
|----------|------------|
| Source has monolithic `spatial-mapping.tsx`, local has hooks | **Keep local decomposition** — port logic into hooks/components |
| Source uses `expo-three` | **Do not add** — use `ExpoThreeRenderer` from `@/utils/ExpoThreeRenderer` |
| Source uses different `RoomData` shape | **Adapt at boundary** — map to `frontend/types/spatial-mapping.ts` |
| Source AR view bundled with scan | **Extract scan-only** — drop AR UI from port |
| Duplicate service classes | **Merge into existing** `SpatialMappingService` / `EnhancedSpatialMappingService` |
| New native module for planes | Evaluate `frontend/native/` — document Expo prebuild requirement |

---

## Technical Constraints

- Use **`@/`** path alias for imports
- Use **`useTheme()`** for colors in any new UI
- Follow hooks/services decomposition — do not grow `spatial-mapping.tsx` back into a monolith
- Support **Android + iOS**; web may be preview-only for camera scan
- Platform checks: `Platform.OS === 'ios' | 'android' | 'web'`
- Test on **development build** if native ARKit/ARCore modules are required

---

## Files You May Modify (Local)

| File | Action |
|------|--------|
| `app/spatial-mapping.tsx` | Wire new features; keep thin |
| `app/live-scan.tsx` | Port live scan improvements |
| `hooks/useSpatialMapping*.ts` | Port scan/calibration logic |
| `hooks/useLiveScan*.ts` | Port frame processing |
| `services/SpatialMappingService.ts` | **Replace simulation with real detection if available** |
| `services/EnhancedSpatialMappingService.ts` | Heatmap / 3D improvements |
| `services/DepthEstimationService.ts` | Depth pipeline |
| `components/spatial-mapping/*` | UI improvements |
| `types/spatial-mapping.ts` | Extend types only if needed |
| `config/spatialMapping.config.ts` | Constants |
| `native/ARPlane.ts` | Native bridge if source has implementation |

## Files to Avoid Rewriting

- `components/ar-view/ARViewScreen.tsx` (unless tiny param/type fix)
- `hooks/ar-view/*` (furniture placement — separate feature)
- Backend Groq controllers / `groqService.js`
- `app/theme-recommend.tsx`, `app/ai-design.tsx` (except navigation params from scan)

---

## Acceptance Tests

1. Open **Spatial Mapping** → start scan (photo or URI) → progress stages complete
2. See **room dimensions**, area, volume, confidence score
3. **Floor plan** renders walls/obstacles
4. **Calibration modal** works if ported
5. **Export** JSON/CSV succeeds
6. **Live Scan** → camera opens → scan progress updates → obstacles listed
7. Tap **Open in AR** (or equivalent) → `/ar-view` receives `roomDataJson` and loads room bounds
8. **AI Design** can receive room context if navigation exists from scan results
9. Android + iOS physical device smoke test
10. No `expo-three` bundling errors; no regression in AR View furniture placement

---

## Suggested Implementation Order

1. Clone shi-ningning repo → produce **analysis table** (Phase 1 deliverable)
2. Diff `SpatialMappingService` and `useLiveScanProcessing` first
3. Port real plane/depth logic if found; keep simulation as fallback
4. Port floor plan + calibration UI fixes
5. Wire navigation to AR View with `roomDataJson`
6. Add backend `spatial_mappings` only if source has it and local needs persistence
7. Run acceptance tests on device
8. Commit on `integrate/spatial-mapping-shi` with message focused on spatial mapping only

---

## What NOT to Do

- Do **not** `git merge` the entire shi-ningning repo into local `main`
- Do **not** replace local AR View architecture
- Do **not** port AI/Groq/theme/auth unrelated files
- Do **not** re-add `expo-three`
- Do **not** commit API keys or `.env` files
- Do **not** commit unless the user explicitly asks

---

## Deliverable

1. **Analysis summary** — table of source spatial files vs local, with port/skip decisions
2. **Working spatial mapping** — scan → room data → floor plan → AR handoff
3. **Short changelog** — what was ported from shi-ningning and what was skipped
4. **Clean git commit** on `integrate/spatial-mapping-shi` (when user requests)

---

## Reference Docs in Target Repo

- `ANTIGRAVITY_AR_FURNITURE_VISUALIZATION_PROMPT.md` — AR work stays separate
- `ANTIGRAVITY_GROQ_COMMIT_INTEGRATION_PROMPT.md` — AI backend already ported
- `docs/HOW_THE_SYSTEM_WORKS.md` — system architecture
- `docs/MONGODB_DOCUMENT_MODEL.md` — `spatial_mappings` schema
- `.cursor/rules/ar-interior-design-app.mdc` — project conventions

**Start by reading:** `frontend/app/spatial-mapping.tsx`, `frontend/services/SpatialMappingService.ts`, `frontend/hooks/useSpatialMappingScan.ts`, `frontend/app/live-scan.tsx`

**Then clone:** `https://github.com/shi-ningning/ARInteriorDesignApp.git` and run the discovery commands in Step 0 before editing any code.
