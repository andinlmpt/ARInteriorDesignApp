# Antigravity Prompt: Integrate GitHub Commit `943203f` (Groq API + Frontend Refactors)

Act as a senior full-stack developer working on **AR Interior Design App**. Your job is to **analyze commit `943203f`** from GitHub branch `fix/expo-three-hermes-crash`, **compare it to the current local `main` branch**, and **selectively port the valuable changes** into the local codebase — then help the user **commit** the result.

---

## Source of Truth

| Item | Value |
|------|-------|
| **Target commit** | `943203f6493cf7beabc8810b781019269048f03b` |
| **Commit message** | `refactor: replace Gemini API with Groq API across design and image generation services, remove unused files, and update frontend components for new image generation flow` |
| **Author** | GeraldV3 |
| **Branch** | `origin/fix/expo-three-hermes-crash` |
| **Parent commit** | `83e288d` (Hermes crash fix — expo-three removal) |
| **Files changed** | 34 files (+6,630 / −8,298 lines) |

### Full branch history (oldest → newest)

```
a30b899  feat: complete AR furniture UI overhaul and interactions
c10df5a  feat: add AI design controller, DesignSession model, FloorPlan2D, frontend screens
83e288d  fix: resolve Hermes engine crash by removing expo-three and downgrading babel-preset-expo
943203f  refactor: replace Gemini API with Groq API … (THIS COMMIT)
```

**Important:** Local `main` and `origin/fix/expo-three-hermes-crash` have **no common merge base** — they are divergent histories. Do **not** blindly `git merge` or `git cherry-pick` without reading conflicts. Prefer **manual selective porting** guided by this document.

---

## Product Goal

> Port the Groq AI backend migration and related frontend improvements from commit `943203f` into the current local codebase **without breaking** the newer AR View refactor (`ARViewScreen.tsx` + `hooks/ar-view/*`).

**Success criteria:**
- Backend uses **Groq API** (`GROQ_API_KEY`) instead of Gemini for design, themes, ideas, and image-related AI calls
- Frontend AI Design and Theme Recommend screens work with the new backend flow
- Local AR architecture (`components/ar-view/ARViewScreen.tsx`) remains intact — do not regress to the remote branch's alternate Manager-hook pattern unless explicitly merging AR logic
- App bundles and runs on device (no Hermes / expo-three crash)
- User can commit clean, reviewable changes with a clear message

---

## Step 0 — Inspect Before Touching Code

Run these commands from repo root (`d:\project\ARInteriorDesignApp-main`):

```powershell
# Fetch latest remote
git fetch origin

# View the commit
git show 943203f --stat

# List every file touched
git show 943203f --name-status

# See full diff for a specific file (example)
git show 943203f -- backend/src/services/groqService.js
git show 943203f -- frontend/app/ai-design.tsx
git show 943203f -- frontend/app/theme-recommend.tsx

# Compare local main vs remote branch (expect "no merge base" — that's OK)
git log main --oneline -5
git log origin/fix/expo-three-hermes-crash --oneline -5
```

Create a working branch before any edits:

```powershell
git checkout -b integrate/groq-943203f
```

---

## What Commit `943203f` Changed (File-by-File)

### Category A — **Port directly** (backend Groq migration)

| File | Change | Action |
|------|--------|--------|
| `backend/src/services/groqService.js` | **Added** — new Groq service (Llama 3.3 70B) | Copy from commit; add to local |
| `backend/src/services/geminiService.js` | **Deleted** | Remove after all imports updated |
| `backend/src/controllers/aiDesignController.js` | `geminiService` → `groqService` | Port diff |
| `backend/src/controllers/ideaAssistantController.js` | Same swap | Port diff |
| `backend/src/controllers/imageGenerationController.js` | Same swap | Port diff |
| `backend/src/server.js` | Minor route/config tweak | Port diff |
| `backend/models_list.txt` | Model list update | Port diff |

**Groq service highlights** (from commit):
- Env: `GROQ_API_KEY`
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Default model: `llama-3.3-70b-versatile`
- Exports: `analyzeDesignPrompt`, `generateDesignRecommendations`, `generateThemeRecommendations`, `generateIdeaResponse`, etc.

**Backend `.env` addition:**
```
GROQ_API_KEY=<your-groq-api-key>
```
Get a key at https://console.groq.com — keep Gemini vars only if other code still references them.

### Category B — **Port with review** (frontend AI screens)

| File | Change | Action |
|------|--------|--------|
| `frontend/app/ai-design.tsx` | Updated image generation flow, layout display | Port UI/logic diff; keep `@/` imports and `useTheme()` |
| `frontend/app/theme-recommend.tsx` | Slimmed orchestrator | Port; large extraction already done in commit |
| `frontend/app/theme-recommend.styles.ts` | **Added** — extracted styles | Copy new file |
| `frontend/components/theme-recommend/ThemeRecommendSteps.tsx` | **Added** | Copy new file |
| `frontend/components/theme-recommend/ThemeRecommendResults.tsx` | **Added** | Copy new file |
| `frontend/components/theme-recommend/RESULTS_BLOCK_TEMP.tsx` | **Added** (temp — consider renaming/cleaning) | Copy; evaluate if still needed |
| `frontend/components/FloorPlan2D.tsx` | Floor plan rendering updates | Port diff carefully |
| `frontend/app.config.js` | Removed 8 lines (likely unused plugin/config) | Compare with local; port only if safe |
| `frontend/package.json` | Removed 1 dependency | Check what was removed before applying |
| `frontend/services/NotificationService.ts` | Notification flow updates | Port diff |

### Category C — **Likely skip or merge manually** (AR architecture conflict)

The remote commit refactored `frontend/app/ar-view.tsx` into a **Manager-hook pattern**:

```
useARFurnitureManager, useARInteractionManager, useARMeasurementManager,
useARLayoutManager, useARDemoManager, useARErrorRecovery
+ ARViewUI.tsx, ARContext.tsx
```

**Local `main` already uses a different, newer refactor:**

```
frontend/app/ar-view.tsx          → thin route wrapper
frontend/components/ar-view/ARViewScreen.tsx   → orchestrator
frontend/hooks/ar-view/useARViewFurniturePlacement.ts
frontend/hooks/ar-view/useARViewSceneGestures.ts
frontend/hooks/useARRenderer.ts
```

| File | Remote change | Local status | Recommendation |
|------|---------------|--------------|----------------|
| `frontend/app/ar-view.tsx` | −5,974 lines (inline → managers) | Already thin wrapper | **Do NOT replace** with remote version |
| `frontend/hooks/useARFurnitureManager.ts` | **Added** (930 lines) | Does not exist locally | **Skip** unless porting specific bugfixes into `useARViewFurniturePlacement.ts` |
| `frontend/hooks/useARInteractionManager.ts` | **Added** (842 lines) | Does not exist | **Skip** — use `useARViewSceneGestures.ts` |
| `frontend/hooks/useARMeasurementManager.ts` | **Added** | Local has `useARMeasurements.ts` | Cherry-pick logic only if missing |
| `frontend/hooks/useARLayoutManager.ts` | **Added** | Review local equivalent | Cherry-pick logic only |
| `frontend/hooks/useARDemoManager.ts` | **Added** | N/A | Optional — demo mode only |
| `frontend/hooks/useARErrorRecovery.ts` | **Added** | N/A | **Consider porting** error recovery patterns into `ARViewErrorBoundary` or a small hook |
| `frontend/components/ar-view/ARViewUI.tsx` | **Added** (625 lines) | Local has split components | **Do NOT overwrite** — compare for missing UI features |
| `frontend/context/ARContext.tsx` | **Added** | N/A | Only add if a concrete feature needs shared AR state |
| `ar-view.tsx` (repo root) | **Deleted** | N/A locally | Ignore — stray file on remote |

**Rule:** For AR, **diff for missing features** (gestures, placement safety, demo mode, error recovery) and port **logic snippets** into existing `hooks/ar-view/*` files — never replace the whole AR stack.

### Category D — **Optional dev utilities** (do not commit secrets)

| File | Purpose | Recommendation |
|------|---------|----------------|
| `backend/create-account.js` | Dev user creation | Add if useful; exclude credentials |
| `backend/seed-user.js` | Seed script | Same |
| `backend/fix-users.js` | User fix utility | Same |
| `backend/test-groq.js` | Groq smoke test | **Add** — useful for verification |
| `backend/test-hf-image.js` | HuggingFace image test | Optional |
| `backend/test-hf-router.js` | HF router test | Optional |
| `backend/test-login.cjs` | Login test | Optional |

### Category E — **Already on local `main`** (from commit `83e288d` parent chain)

These Hermes fixes may already exist locally — **verify before re-applying**:

| File | Fix |
|------|-----|
| `frontend/utils/ExpoThreeRenderer.ts` | Local drop-in for `expo-three` |
| `frontend/babel.config.js` | babel-preset-expo downgrade |
| `frontend/metro.config.js` | Removed expo-three resolver |
| `frontend/hooks/useARRenderer.ts` | Uses `ExpoThreeRenderer` |
| `frontend/TROUBLESHOOTING.md` | Hermes crash docs |

```powershell
# Quick check — local should already have ExpoThreeRenderer
Test-Path frontend/utils/ExpoThreeRenderer.ts
```

If present, **skip** re-porting `83e288d` unless diff shows newer fixes.

---

## Recommended Integration Order

### Phase 1 — Backend Groq (highest value, lowest risk)

1. Extract `groqService.js` from commit:
   ```powershell
   git show 943203f:backend/src/services/groqService.js > backend/src/services/groqService.js
   ```
2. Update controllers to import `groqService` instead of `geminiService`
3. Add `GROQ_API_KEY` to `backend/.env` and document in `backend/ENV_SETUP.md`
4. Run smoke test:
   ```powershell
   cd backend
   node test-groq.js
   ```
5. Remove `geminiService.js` only after zero remaining imports:
   ```powershell
   rg "geminiService" backend/src
   ```
6. Start backend and hit `/api/designs/generate` (or equivalent) from frontend

### Phase 2 — Frontend AI Design + Theme Recommend

1. Port `theme-recommend` component extractions (new files + slimmed screen)
2. Port `ai-design.tsx` image generation flow changes
3. Update `FloorPlan2D.tsx` if AI design depends on new props
4. Align frontend API calls with backend response shapes (Groq JSON may differ slightly from Gemini)
5. Remove or update any frontend references to Gemini-specific error messages

### Phase 3 — AR (selective only)

1. Read remote `useARFurnitureManager.ts` and `useARInteractionManager.ts` for **features local lacks**
2. Port missing behavior into:
   - `hooks/ar-view/useARViewFurniturePlacement.ts`
   - `hooks/ar-view/useARViewSceneGestures.ts`
   - `components/ar-view/ARViewScreen.tsx`
3. Consider porting `useARErrorRecovery.ts` patterns if error UX is better on remote
4. **Do not** replace `ARViewScreen.tsx` with remote `ARViewUI.tsx` wholesale

### Phase 4 — Verify & Commit

See Acceptance Tests below, then commit (only when user asks):

```powershell
git add backend/src/services/groqService.js
git add backend/src/controllers/
# ... other ported files
git status
git diff --staged --stat
```

Suggested commit message:

```
refactor: migrate AI services from Gemini to Groq API

Port backend Groq integration and frontend AI/theme screen updates
from commit 943203f; preserve local AR View architecture.
```

---

## How to Extract a Single File from the Commit

```powershell
# Write file contents from commit to working tree
git show 943203f:<path-in-repo> > <local-path>

# Or view side-by-side mentally
git show 943203f -- <path-in-repo>
```

For partial merges, use your editor's diff or:

```powershell
git diff 943203f^..943203f -- backend/src/controllers/aiDesignController.js
```

---

## Conflict Decision Matrix

When the same file was changed both locally and in `943203f`:

| Scenario | Resolution |
|----------|------------|
| Backend controller imports | Always use `groqService` from commit |
| `ar-view.tsx` | Keep local thin wrapper |
| `ARViewScreen.tsx` vs remote managers | Keep local; port logic only |
| `theme-recommend.tsx` | Prefer commit's extracted components |
| `package.json` | Union merge — keep local Expo SDK 54 pins; drop only deps commit explicitly removed (likely `expo-three`) |
| `useARRenderer.ts` | Keep local version if `ExpoThreeRenderer` already wired |
| `NotificationService.ts` | Read both; merge notification types/handlers |

---

## Environment & Config Checklist

- [ ] `GROQ_API_KEY` set in `backend/.env`
- [ ] `PEXELS_API_KEY` still set (image search unchanged in spirit)
- [ ] `MONGODB_URI`, `JWT_SECRET` unchanged
- [ ] Remove dead `GEMINI_API_KEY` references after migration (or keep as fallback only if code supports it)
- [ ] Frontend `apiClient.ts` base URL still points to backend
- [ ] No secrets in committed files

---

## Acceptance Tests

### Backend
1. `cd backend && npm test` — existing tests pass
2. `node test-groq.js` — Groq API returns a response
3. POST design generation endpoint — returns layout JSON
4. Theme recommendation endpoint — returns themes
5. Idea assistant endpoint — returns text

### Frontend
1. `cd frontend && npm start` — bundles without `expo-three` errors
2. Open **AI Design** — generate layout; see floor plan + furniture list
3. Open **Theme Recommend** — complete steps; see results with images
4. Open **AR View** — still works (placement, gestures) — **no regression**
5. Physical device smoke test (Android or iOS)

### Git
1. `git status` — only intentional files staged
2. No `.env` files staged
3. Commit message reflects Groq migration + selective port

---

## Files to Read First (Local Codebase)

Before porting, understand current local state:

```
backend/src/services/geminiService.js          # What you're replacing
backend/src/controllers/aiDesignController.js  # Current imports
frontend/app/ai-design.tsx
frontend/app/theme-recommend.tsx
frontend/components/ar-view/ARViewScreen.tsx   # Do not break
frontend/hooks/ar-view/useARViewFurniturePlacement.ts
frontend/utils/ExpoThreeRenderer.ts            # Hermes fix already here
.cursor/rules/ar-interior-design-app.mdc       # Project conventions
```

Then read from commit:

```
git show 943203f:backend/src/services/groqService.js
git show 943203f:frontend/app/ai-design.tsx
git show 943203f:frontend/app/theme-recommend.tsx
```

---

## What NOT to Do

- Do **not** `git merge origin/fix/expo-three-hermes-crash` without expecting massive conflicts
- Do **not** replace local `ARViewScreen.tsx` / `hooks/ar-view/*` with remote Manager hooks
- Do **not** re-add `expo-three` to `package.json`
- Do **not** commit API keys, test credentials, or `create-account.js` with hardcoded passwords
- Do **not** commit unless the user explicitly asks

---

## Deliverable

1. **Analysis summary** — what was ported, what was skipped, and why (especially AR)
2. **Working Groq backend** with updated controllers
3. **Updated AI Design + Theme Recommend** frontend (if in scope)
4. **AR View unchanged or improved** — no architectural regression
5. **Clean git commit** on branch `integrate/groq-943203f` (when user requests)

---

## Reference

- Commit: `943203f` on `origin/fix/expo-three-hermes-crash`
- Related local prompt: `ANTIGRAVITY_AR_FURNITURE_VISUALIZATION_PROMPT.md` (AR work stays separate)
- Groq docs: https://console.groq.com/docs
- Project rules: `.cursor/rules/ar-interior-design-app.mdc`

**Start by running:** `git show 943203f --name-status` and categorizing each file into A/B/C/D/E above before editing any code.
