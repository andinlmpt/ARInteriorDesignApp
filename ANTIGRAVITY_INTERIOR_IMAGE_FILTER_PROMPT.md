# Antigravity Prompt: Interior-Only Image Filtering (Theme Recommend + Explore)

Act as a senior full-stack developer working on **AR Interior Design App**. Your job is to **filter all design inspiration images** so users only see **interior design / home decor photos** — not coffee, food, eggs, people, wallets, perfume, fashion, or random product shots.

**Affected screens:**
- **Theme Recommend** (`/theme-recommend`) — AI/Pexels images per theme
- **Explore** (`/(tabs)/explore`) — Pexels search grid (user screenshot shows irrelevant results here too)
- **AI Design** (`/ai-design`) — layout preview images (same backend path)

All three call **`POST /api/v1/images/generate`** → `backend/src/controllers/imageGenerationController.js`.

---

## Product Goal (User Story)

> As a user browsing theme recommendations or Explore, I only want to see photos of **rooms, furniture, and interior spaces** — never unrelated stock photos.

**Success criteria:**
- Theme result images show **rooms / interiors** matching room type + style
- Explore search for "modern" or "minimalist" returns **living rooms, bedrooms, kitchens** — not people, coffee, or product flat-lays
- Pexels fallback (when Hugging Face is unavailable) is also filtered
- No regression in HF/Groq AI image generation (already interior-focused)
- Filter runs **server-side** (single source of truth)

---

## Root Cause (Already Identified in Code)

### 1. Weak Pexels query for custom / Explore searches

In `imageGenerationController.js`, `buildSearchQuery()`:

```javascript
// When customDesign is set (Explore uses this):
return `${keywords || customText} ${randomVibe}`.substring(0, 100);
// ❌ Does NOT append "interior design" or room context
// ❌ randomVibe can be "lifestyle" → people & lifestyle stock photos
```

`DESIGN_VIBES` includes **`lifestyle`** — this is a major source of irrelevant images (people, coffee, fashion).

### 2. No post-search filtering

`performPexelsSearch()` returns all 20 photos from Pexels with:
- Random page `1–10` (dilutes relevance)
- Random orientation
- **Zero filtering** on `photo.alt`, dimensions, or keywords

### 3. Shared pipeline

| Consumer | File | How it calls backend |
|----------|------|----------------------|
| Explore | `hooks/usePexelsSearch.ts` | `customDesign: trimmedQuery`, `forcePexels: true` |
| Theme images | `hooks/useThemeImageGeneration.ts` | `DesignImageGenerationService` → `/images/generate` |
| AI Design | `app/ai-design.tsx` | Same service |

**Fix once in the backend** — all screens benefit.

---

## Step 0 — Reproduce Before Fixing

1. Start backend + frontend
2. Open **Explore** → tap Quick Search **"Modern"** or search `minimalist`
3. Observe irrelevant images (people, perfume, wallet, kitchenware product shots)
4. Open **Theme Recommend** → complete flow → generate theme image with Pexels fallback (`forcePexels` or disable HF key temporarily)
5. Log the Pexels query: check backend console for `[ImageGeneration] Searching Pexels for: "..."`

---

## What Antigravity Must Build

### Phase 1 — Tighten search queries (backend)

**File:** `backend/src/controllers/imageGenerationController.js`

#### A. Replace `DESIGN_VIBES` with interior-safe terms

Remove: `lifestyle`, generic vibes that broaden results.

Use only terms like:

```javascript
const INTERIOR_SEARCH_MODIFIERS = [
  'interior design',
  'home interior',
  'room decor',
  'furniture',
  'living space',
];
```

Pick **one** modifier per request (deterministic or rotate) — always include **`interior`** context.

#### B. Fix `buildSearchQuery()` for `customDesign` path

When user searches "modern" or Explore sends `customDesign`:

```javascript
// BEFORE (bad):
// `${keywords} lifestyle`

// AFTER (good):
// `${roomType || 'living room'} ${style || 'modern'} interior design ${keywords}`
// Always ensure query contains: interior OR room OR furniture
```

Rules:
- Always append **`interior design`** (or `home interior`)
- Map bare style words (`modern`, `cozy`, `minimalist`) → `"${word} living room interior design"`
- Cap at 100 chars but **never drop** the interior suffix
- If `preferences.roomType` is set (theme flow), use it: `"${roomType} ${style} interior design"`

#### C. Stabilize Pexels pagination

In `performPexelsSearch()`:
- Prefer **page 1–3** instead of 1–10 for relevance
- Prefer **`orientation=landscape`** for room shots (interiors are usually horizontal)
- Fetch **`per_page=40`** if filtering will discard many results (stay within Pexels limits)

---

### Phase 2 — Post-filter Pexels results (backend)

**New file:** `backend/src/utils/interiorImageFilter.js`

```javascript
/**
 * Score and filter Pexels photos to keep interior-design-relevant images only.
 * Uses photo.alt (Pexels provides alt text), optional url hints, aspect ratio.
 */

const BLOCKLIST = [
  // food & drink
  'coffee', 'espresso', 'latte', 'egg', 'food', 'breakfast', 'restaurant', 'cafe',
  // people / fashion
  'person', 'people', 'woman', 'man', 'girl', 'boy', 'portrait', 'model', 'fashion',
  'jeans', 'shirt', 'hat', 'wallet', 'handbag', 'shoe',
  // unrelated products
  'perfume', 'cosmetic', 'makeup', 'skincare', 'bottle', 'watch', 'jewelry',
  // outdoor / nature (unless explicitly patio interior)
  'mountain', 'forest', 'beach', 'sky', 'sunset',
];

const ALLOWLIST = [
  'interior', 'room', 'living room', 'bedroom', 'kitchen', 'bathroom', 'dining',
  'home', 'house', 'apartment', 'furniture', 'sofa', 'couch', 'chair', 'table',
  'bed', 'lamp', 'decor', 'wall', 'floor', 'ceiling', 'window', 'curtain',
  'cabinet', 'shelf', 'fireplace', 'rug', 'carpet', 'office', 'studio',
  'minimalist interior', 'modern interior', 'scandinavian',
];

export function isInteriorPhoto(photo) { /* ... */ }
export function filterInteriorPhotos(photos, { minScore = 1, minResults = 6 } = {}) { /* ... */ }
```

**Scoring logic (suggested):**
- `+2` for each allowlist term found in `photo.alt` (case-insensitive)
- `-3` for each blocklist term in `photo.alt`
- `+1` if `width > height` (landscape — typical room photos)
- **Reject** if any blocklist term matches
- **Keep** if score ≥ 1 (at least one interior signal)

If fewer than `minResults` after filter:
1. Retry Pexels with a **more specific** query (append `living room interior`)
2. Do **not** return unfiltered junk — better fewer images than wrong images

**Apply in** `performPexelsSearch()` before `res.json({ photos: enhancedPhotos })`:

```javascript
const filtered = filterInteriorPhotos(data.photos);
if (filtered.length === 0) {
  // retry with stricter query or next page — see Phase 1C
}
```

---

### Phase 3 — Frontend query hygiene (optional but recommended)

**File:** `frontend/hooks/usePexelsSearch.ts`

Before calling API, normalize user query:

```typescript
function toInteriorSearchQuery(raw: string): string {
  const q = raw.trim().toLowerCase();
  if (/\b(interior|room|bedroom|kitchen|living|furniture|home)\b/.test(q)) {
    return q;
  }
  return `${q} living room interior design`;
}
```

**File:** `frontend/app/(tabs)/explore.tsx`

- Quick search already uses `` `${category.name} interior design` `` — **keep this**
- User free-text search should go through `toInteriorSearchQuery()`

**File:** `frontend/hooks/useThemeImageGeneration.ts`

- Ensure `preferences` passed to API always includes `roomType`, `style`, `mood` from theme selection (already mostly done — verify)

---

### Phase 4 — Groq visual prompts (already OK, verify only)

`groqService.enhanceVisualPrompt()` already asks for interior photography. **No major change needed** for HF path.

For **Groq-enhanced Pexels fallback** (`prompt-only` → `performPexelsSearch`), ensure the enhanced prompt is truncated but still contains **room + interior** keywords before search.

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/controllers/imageGenerationController.js` | Fix `buildSearchQuery`, `DESIGN_VIBES`, `performPexelsSearch` |
| `backend/src/utils/interiorImageFilter.js` | **Create** — blocklist/allowlist filter |
| `backend/tests/interiorImageFilter.test.js` | **Create** — unit tests for filter |
| `frontend/hooks/usePexelsSearch.ts` | Normalize search query |
| `frontend/app/(tabs)/explore.tsx` | Use normalized query on search (if not in hook) |

## Files to Avoid Changing

- Theme recommendation AI logic (`useThemeRecommendations.ts`) — not related to images
- Groq service (unless prompt-only fallback needs one line)
- AR View, spatial mapping, auth

---

## Acceptance Tests

### Explore tab
1. Search **"modern"** → all grid images show **rooms/interiors** (no people-only, coffee, perfume, wallet)
2. Quick tap **Minimalist** → interiors only
3. Search **"cozy bedroom"** → bedroom interiors
4. Empty filter → show friendly message, not random photos

### Theme Recommend
1. Complete flow: Living Room + Calm + Modern → generated/fallback image is a **room interior**
2. Alternative themes — images match style names

### AI Design
1. Generate layout → preview image is interior (HF or filtered Pexels)

### Backend unit tests
```javascript
// block coffee shop photo
isInteriorPhoto({ alt: 'woman drinking coffee in cafe' }) === false

// allow living room
isInteriorPhoto({ alt: 'modern minimalist living room interior' }) === true
```

Run: `cd backend && npm test`

---

## Suggested Implementation Order

1. Add `interiorImageFilter.js` + tests
2. Integrate filter in `performPexelsSearch()`
3. Fix `buildSearchQuery()` — remove `lifestyle`, always add interior context
4. Tune Pexels pagination (pages 1–3, landscape, per_page 40)
5. Frontend query normalization in `usePexelsSearch.ts`
6. Manual test Explore + Theme Recommend on device
7. Commit on branch `fix/interior-image-filter`

Suggested commit message:

```
fix: filter Pexels results to interior design images only

Tighten search queries and post-filter photos by alt-text so theme
recommendations and Explore no longer show irrelevant lifestyle/product shots.
```

---

## Technical Constraints

- Filter **server-side** — do not trust client-only filtering
- Do not expose Pexels API key to frontend
- Keep `forcePexels: true` behavior for Explore
- Preserve HF/Groq image generation path unchanged
- Use existing `@/` imports on frontend; ESM on backend

---

## What NOT to Do

- Do **not** remove Pexels entirely — filter and improve queries
- Do **not** return unfiltered photos as fallback when filter yields zero (retry with better query instead)
- Do **not** use `lifestyle` as a search modifier
- Do **not** commit API keys
- Do **not** break `photos[]` array response used by Explore `FlatList`

---

## Reference — Current Code Locations

```
backend/src/controllers/imageGenerationController.js   # buildSearchQuery, performPexelsSearch
backend/src/services/groqService.js                    # HF prompt enhancement (OK)
frontend/hooks/usePexelsSearch.ts                      # Explore → /images/generate
frontend/hooks/useThemeImageGeneration.ts              # Theme images
frontend/app/(tabs)/explore.tsx                        # Explore UI grid
frontend/components/theme-recommend/ThemeRecommendResults.tsx  # Theme image display
frontend/services/DesignImageGenerationService.ts      # API client
```

**Start by reading:** `imageGenerationController.js` lines 38–107 (`DESIGN_VIBES`, `buildSearchQuery`) and 182–280 (`performPexelsSearch`).

**Deliverable:** Explore and Theme Recommend show **only interior design images**; backend tests pass; clean commit when user requests.
