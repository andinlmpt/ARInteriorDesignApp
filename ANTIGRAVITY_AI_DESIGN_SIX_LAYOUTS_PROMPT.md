# Antigravity Prompt: AI Design — 6 Layouts + Preview Image for Each

Act as a senior full-stack developer working on **AR Interior Design App**. Your job is to **increase AI Design output from 3 to 6 layout variations** and **generate a 3D preview image for every layout** (not just the active tab).

---

## Product Goal (User Story)

> As a user, when I generate an AI Design, I want **6 different furniture layout options**, each with its own **photorealistic preview image**, so I can compare more ideas before choosing one for AR View.

**Success criteria:**
- Backend returns **exactly 6** layout variations per generation request
- Frontend shows **Layout 1–6** tabs
- **All 6 preview images** generate automatically (Hugging Face / Groq+HF path)
- Thumbnail strip lets user switch layouts quickly
- Fallback (when Groq fails) also returns 6 layouts
- No regression in floor plan, auth, or `/design/generate` API

---

## Current vs Target

| | Before | After |
|--|--------|-------|
| Layout count | 3 | **6** |
| Groq prompt | "Generate exactly 3…" | "Generate exactly 6…" |
| Preview images | Only active layout | **All 6 layouts** |
| UI | Layout tabs only | Tabs + **thumbnail strip** |

---

## Step 0 — Read Before Coding

```powershell
cd d:\project\ARInteriorDesignApp-main   # or your local clone

# Key files
backend/src/controllers/aiDesignController.js   # generateLayout, generateFallbackLayouts
frontend/app/ai-design.tsx                      # results UI + image gen
frontend/config/aiDesign.config.ts              # LAYOUT_VARIATION_COUNT constant
```

Create branch:

```powershell
git checkout -b feature/ai-design-six-layouts
```

---

## What Antigravity Must Implement

### Phase 1 — Backend: 6 layout variations

**File:** `backend/src/controllers/aiDesignController.js`

#### A. Add constant + padding helper (near top, after `GA_CONFIG`)

```javascript
/** Number of layout variations returned per AI Design request */
const LAYOUT_VARIATION_COUNT = 6;

function padLayoutsToCount(layouts, count = LAYOUT_VARIATION_COUNT) {
  if (!Array.isArray(layouts) || layouts.length === 0) return layouts;

  const result = layouts.map((layout, index) => ({
    ...layout,
    id: layout.id || `layout_${index + 1}`,
    furniture: Array.isArray(layout.furniture) ? layout.furniture : [],
    safety_warnings: Array.isArray(layout.safety_warnings) ? layout.safety_warnings : [],
  }));

  while (result.length < count) {
    const base = layouts[result.length % layouts.length];
    result.push({
      ...base,
      id: `layout_${result.length + 1}`,
      score: Math.max(50, (base.score || 70) - (result.length - layouts.length + 1) * 5),
      furniture: (base.furniture || []).map((item) => ({ ...item })),
      safety_warnings: [...(base.safety_warnings || [])],
    });
  }

  return result.slice(0, count);
}
```

#### B. Update `generateFallbackLayouts()` return

At the end of the function, wrap switch result:

```javascript
  let layouts;
  switch (catalogKey) {
    case 'Bedroom':     layouts = buildBedroom(); break;
    case 'Dining Room': layouts = buildDining(); break;
    case 'Office':      layouts = buildOffice(); break;
    default:            layouts = buildLivingRoom();
  }
  return padLayoutsToCount(layouts);
```

(Do **not** rewrite `buildLivingRoom` / `buildBedroom` etc. — padding duplicates with varied scores.)

#### C. Update `generateLayout()` Groq prompt

Replace all hardcoded `3` with `LAYOUT_VARIATION_COUNT`:

- System prompt: `Generate exactly ${LAYOUT_VARIATION_COUNT} furniture layout variations`
- Rules: `Always include exactly ${LAYOUT_VARIATION_COUNT} layout objects`
- User prompt: `Generate ${LAYOUT_VARIATION_COUNT} different optimized furniture layout variations`

Remove the old inline JSON example for `layout_2` and `layout_3` only — one example layout in the schema is enough (saves tokens).

Add rule: `Each layout must be meaningfully different (furniture placement, focal point, or flow)`

#### D. Increase token limit

```javascript
max_tokens: 8192,   // was 4096 — 6 layouts need more JSON space
```

#### E. Replace padding loop after Groq parse

**Remove:**
```javascript
while (parsed.layouts.length < 3) { ... }
```

**Replace with:**
```javascript
parsed.layouts = padLayoutsToCount(parsed.layouts);
finalJson = parsed;
```

---

### Phase 2 — Frontend config constant

**File:** `frontend/config/aiDesign.config.ts`

```typescript
/** Layout variations + preview renders per AI Design generation */
export const LAYOUT_VARIATION_COUNT = 6;
```

Also bump image memory limit:

```typescript
MAX_IMAGES_IN_MEMORY: 12,  // was 10
```

---

### Phase 3 — Frontend: generate all preview images

**File:** `frontend/app/ai-design.tsx`

#### A. Import constant

```typescript
import { LAYOUT_VARIATION_COUNT } from '@/config/aiDesign.config';
```

#### B. Replace single-layout image effect

**Remove** (generates only active tab):
```typescript
useEffect(() => {
  if (step === 4 && layouts.length > 0) {
    const currentLayout = layouts[activeLayoutIndex];
    if (currentLayout && !generatedImages[currentLayout.id] && !isGeneratingImage[currentLayout.id]) {
      handleGenerateImage(currentLayout);
    }
  }
}, [step, activeLayoutIndex, layouts]);
```

**Add** (generates all layouts):
```typescript
useEffect(() => {
  if (step !== 4 || layouts.length === 0) return;

  layouts.forEach((layout) => {
    if (!generatedImages[layout.id] && !isGeneratingImage[layout.id]) {
      handleGenerateImage(layout);
    }
  });
}, [step, layouts]);
```

**Note:** 6 parallel HF requests may take 20–40s total and use API quota. Do **not** serialize unless HF rate-limits — parallel is acceptable for v1.

#### C. Update loading copy (Step 3)

```typescript
AI is generating {LAYOUT_VARIATION_COUNT} optimized furniture layouts for your {roomWidth}m × {roomDepth}m room
```

(Remove any reference to "Gemini" — backend uses Groq.)

---

### Phase 4 — Frontend: thumbnail preview strip

Inside `renderStep4()`, **before** the main "3D Photorealistic Render" section, add horizontal thumbnails:

```tsx
{layouts.length > 1 && (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
    {layouts.map((layout, idx) => (
      <TouchableOpacity
        key={`preview-${layout.id}`}
        style={[
          styles.previewThumb,
          { borderColor: activeLayoutIndex === idx ? colors.accent : colors.border },
        ]}
        onPress={() => setActiveLayoutIndex(idx)}
      >
        {generatedImages[layout.id] ? (
          <Image source={{ uri: generatedImages[layout.id] }} style={styles.previewThumbImage} resizeMode="cover" />
        ) : (
          <View style={[styles.previewThumbPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
            {isGeneratingImage[layout.id] ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Layout {idx + 1}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    ))}
  </ScrollView>
)}
```

**Styles to add** (in `StyleSheet.create`):

```typescript
previewScroll: { marginTop: 8, marginBottom: 4 },
previewThumb: {
  width: 72,
  height: 72,
  borderRadius: 10,
  borderWidth: 2,
  overflow: 'hidden',
  marginRight: 8,
},
previewThumbImage: { width: '100%', height: '100%' },
previewThumbPlaceholder: {
  flex: 1,
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
},
```

Use **`useTheme()`** for colors — no hardcoded theme colors beyond accent borders.

---

## API Contract (unchanged shape)

```
POST /api/v1/design/generate
Authorization: Bearer <token>
Body: {
  roomDimensions: { width, height, depth },
  detectedObstacles: string[],
  availableFloorSpace: number,
  roomType: string,
  style: string
}
Response: GeneratedLayout[]   // now length 6
```

Each layout object:

```typescript
{
  id: string;
  furniture: FurnitureItem[];
  safety_warnings: string[];
  score: number;
}
```

Image generation (unchanged, called per layout):

```
POST /api/v1/images/generate
Body: { proposal, preferences }
```

Requires `GROQ_API_KEY` + `HF_API_KEY` in `backend/.env` for AI renders.

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/controllers/aiDesignController.js` | Constant, `padLayoutsToCount`, Groq prompt, fallback padding |
| `frontend/config/aiDesign.config.ts` | `LAYOUT_VARIATION_COUNT = 6` |
| `frontend/app/ai-design.tsx` | All-layout image gen + thumbnails + loading text |

## Files NOT to change

- `groqService.js` (unless layout prompt lives there — it doesn't)
- `FloorPlan2D.tsx` — works with any layout count
- AR View, theme recommend, explore tabs

---

## Acceptance Tests

1. Generate AI Design → backend returns **6 layouts** (check network tab or log)
2. UI shows **Layout 1–6** tabs with scores
3. **6 preview images** start generating (spinners on thumbnails)
4. Tap each thumbnail → main render + floor plan update
5. Groq failure → fallback still returns 6 layouts
6. Restart backend after deploy; `GROQ_API_KEY` configured
7. No crash when HF is slow — partial images OK, rest load later

---

## Optional Enhancements (if time permits)

- **Sequential image queue** (2 at a time) to reduce HF rate-limit errors
- **Env override:** `LAYOUT_VARIATION_COUNT=8` in backend `.env`
- Apply same count in future **chat-based AI Design** (`ANTIGRAVITY_AI_DESIGN_CHAT_PROMPT.md`)

---

## Suggested Commit Message

```
feat: generate 6 AI design layouts with preview image for each

Increase layout variations from 3 to 6, pad Groq/fallback responses,
and auto-generate Hugging Face renders for all layouts with thumbnail UI.
```

---

## Related Prompts

- `ANTIGRAVITY_AI_DESIGN_CHAT_PROMPT.md` — conversational prompt-first flow (use same `LAYOUT_VARIATION_COUNT`)
- `ANTIGRAVITY_GROQ_COMMIT_INTEGRATION_PROMPT.md` — Groq backend setup
- `ANTIGRAVITY_INTERIOR_IMAGE_FILTER_PROMPT.md` — interior-only Pexels/HF images

---

## What NOT to Do

- Do **not** keep hardcoded `3` anywhere in `generateLayout`
- Do **not** generate images only for `activeLayoutIndex`
- Do **not** remove auth on `/design/generate`
- Do **not** commit `.env` API keys

**Start by reading:** `backend/src/controllers/aiDesignController.js` → `generateLayout()` and `frontend/app/ai-design.tsx` → `renderStep4()`.

**Deliverable:** AI Design returns **6 layouts**, each with an auto-generated preview image and thumbnail navigation.
