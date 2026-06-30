# Antigravity Prompt: AI Design Chat — Prompt-First Flow (ChatGPT / Gemini Style)

Act as a senior React Native / Expo / full-stack developer working on **AR Interior Design App**. Your job is to **redesign the AI Design experience** so users **type what they want in natural language** (like ChatGPT or Gemini) instead of filling out a multi-step form — and the system **parses, confirms, and generates** layouts + images automatically.

---

## Product Goal (User Story)

> As a user, I open AI Design, type *"Design a cozy minimalist bedroom, 4m by 5m, with a window on the left wall and space for a desk"* in a chat bar, and the app understands my request, generates furniture layouts and a room image — all in a conversational thread.

**Success criteria:**
- **Single primary input** — bottom-fixed chat/search bar (ChatGPT/Gemini pattern)
- User describes room + style + constraints in **one prompt** (follow-ups only when required)
- System **extracts** room type, style, dimensions, obstacles via Groq (`/ideas/analyze`)
- System **generates** 6 layout options + floor plan + preview image
- Results appear **inline in the chat** as rich cards (not a separate wizard)
- Existing integrations still work: theme handoff, spatial mapping `roomData`, AR View navigation
- Mobile-first: keyboard-safe, scrollable thread, haptic feedback on send

---

## Current vs Target Flow

### Today (`frontend/app/ai-design.tsx`)

```
Step 1: Manual dimensions (W × D × H inputs)
    ↓
Step 2: Chip selectors (room type + style)
    ↓
Step 3: Loading shimmer
    ↓
Step 4: Layout tabs + FloorPlan2D + auto image gen
```

**Problems:**
- Too many taps before generation
- User must know exact measurements upfront
- Not conversational — feels like a form, not AI
- Ignores existing **`IdeaAssistantService`** and refactored hooks (`useAIDesignGeneration`, etc.)

### Target (Chat-first)

```
┌─────────────────────────────────────────┐
│  AI Design Assistant          [···]     │
├─────────────────────────────────────────┤
│  🤖 Hi! Describe the room you want...   │
│                                         │
│  [Try: "Modern living room 5×4m"]       │  ← suggestion chips
│                                         │
│         👤 Cozy minimalist bedroom...   │
│                                         │
│  🤖 I understood:                       │
│     ┌─────────────────────────────┐     │
│     │ Bedroom · Minimalist        │     │
│     │ 4.5m × 5.0m × 2.7m (default)│     │
│     │ [Generate layouts] [Edit] │     │
│     └─────────────────────────────┘     │
│                                         │
│  🤖 Here are 3 layout options:          │
│     ┌──── FloorPlan2D ────┐             │
│     │  Layout 1  Score 85│             │
│     └─────────────────────┘             │
│     [🖼 Preview] [AR View] [Save]       │
├─────────────────────────────────────────┤
│  Describe your dream room...      [↑]   │  ← ChatGPT-style input
└─────────────────────────────────────────┘
```

---

## Architecture — Reuse What Exists

Do **not** rebuild AI from scratch. Wire existing backend + services:

| Capability | Existing API / Service | Use in chat flow |
|------------|------------------------|------------------|
| Parse natural language | `POST /api/v1/ideas/analyze` → `groqService.analyzeDesignPrompt` | Step 1 after user sends message |
| Generate layouts (Groq JSON) | `POST /api/v1/design/generate` → `aiDesignController.generateLayout` | Step 2 — needs auth token |
| Full GA proposals (optional) | `POST /api/v1/designs/generate` → `GenerativeAIDesignService` | Alternative / enrichment |
| Room images | `POST /api/v1/images/generate` → `DesignImageGenerationService` | Step 3 per layout |
| Local fallback parse | `IdeaAssistantService.analyzePromptLocally` | Offline / API fail |
| Default dimensions | `ideaAssistantController` `DEFAULT_DIMENSIONS` | When user omits sizes |

### Frontend modules already in repo (use these)

```
frontend/services/IdeaAssistantService.ts     # analyzePrompt()
frontend/services/DesignImageGenerationService.ts
frontend/services/GenerativeAIDesignService.ts
frontend/hooks/useAIDesignGeneration.ts       # generation state machine
frontend/hooks/useAIDesignForm.ts               # form state (adapt → chat context)
frontend/hooks/useAIDesignUI.ts                 # UI state
frontend/config/aiDesign.config.ts              # ROOM_TYPES, STYLES, LIMITS
frontend/components/FloorPlan2D.tsx
frontend/utils/aiDesignBusinessLogic.ts
frontend/types/ai-design.ts
frontend/types/ai-design-ui.ts
```

**Refactor `ai-design.tsx`** into a thin screen + chat components — follow decomposition like `theme-recommend/`.

---

## Step 0 — Read Before Coding

```powershell
# Key files
frontend/app/ai-design.tsx
frontend/services/IdeaAssistantService.ts
frontend/hooks/useAIDesignGeneration.ts
frontend/config/aiDesign.config.ts
backend/src/controllers/ideaAssistantController.js
backend/src/controllers/aiDesignController.js   # generateLayout
backend/src/services/groqService.js             # analyzeDesignPrompt
```

Create branch:

```powershell
git checkout -b feature/ai-design-chat-flow
```

---

## What Antigravity Must Build

### Phase 1 — Chat UI (ChatGPT / Gemini look)

**New components** under `frontend/components/ai-design/`:

| Component | Purpose |
|-----------|---------|
| `AIDesignChatScreen.tsx` | Main orchestrator (or slim `ai-design.tsx` wrapper) |
| `AIDesignChatThread.tsx` | `FlatList` / `ScrollView` of messages |
| `AIDesignChatInput.tsx` | Bottom bar: `TextInput` + send button + mic placeholder (optional) |
| `AIDesignMessageBubble.tsx` | User (right) vs assistant (left) bubbles |
| `AIDesignIntentCard.tsx` | Parsed room/style/dimensions summary + Confirm / Edit |
| `AIDesignLayoutCard.tsx` | Floor plan thumbnail, score, warnings, actions |
| `AIDesignSuggestionChips.tsx` | Empty-state quick prompts |

**Visual requirements:**
- Input **pinned to bottom** with `KeyboardAvoidingView` + safe area
- Rounded input field, subtle border, send icon (arrow up) like ChatGPT
- Assistant messages use `colors.surfacePrimary`; user messages use `colors.accent`
- Use **`useTheme()`** — no hardcoded colors
- Multi-line input (max ~4 lines), `returnKeyType="send"`

**Example suggestion chips:**
- "Modern living room 5×4m with sofa and TV"
- "Small minimalist bedroom, budget-friendly"
- "Home office with desk by the window"

---

### Phase 2 — Chat state machine (`useAIDesignChat.ts`)

**New hook:** `frontend/hooks/useAIDesignChat.ts`

```typescript
type ChatMessage =
  | { id: string; role: 'user'; text: string; createdAt: number }
  | { id: string; role: 'assistant'; type: 'text'; text: string }
  | { id: string; role: 'assistant'; type: 'intent'; analysis: PromptAnalysis }
  | { id: string; role: 'assistant'; type: 'layouts'; layouts: GeneratedLayout[] }
  | { id: string; role: 'assistant'; type: 'image'; layoutId: string; imageUrl: string }
  | { id: string; role: 'assistant'; type: 'loading'; label: string }
  | { id: string; role: 'assistant'; type: 'error'; message: string };
```

**Flow:**

1. **User sends message** → append user bubble → show loading bubble ("Understanding your request…")
2. Call `ideaAssistantService.analyzePrompt(text)`
3. **Merge defaults** for missing fields:
   - No dimensions → `DEFAULT_DIMENSIONS[roomType]` from backend or `aiDesign.config` fallbacks
   - No room type → infer from keywords or ask: *"Which room is this for?"* (one assistant text bubble, wait for reply)
   - No style → default `"Modern"`
4. Append **`intent` card** — user taps **Generate** or types "yes" / "generate"
5. Loading bubble → `POST /design/generate` with parsed payload
6. Append **`layouts` card** with `FloorPlan2D` + layout switcher (1 of 3)
7. Auto-trigger image gen per active layout (reuse current `handleGenerateImage` logic)
8. Append **`image` card** when ready

**Follow-up logic (conversational, not wizard):**
- If prompt &lt; 10 chars → assistant: "Tell me a bit more — room type, style, or size?"
- If ambiguous room → assistant asks in chat; **next user message** continues same session
- Support **refinement**: user says "make it more minimalist" → re-analyze with conversation context (append prior intent to Groq prompt)

---

### Phase 3 — Backend enhancement (optional but recommended)

**New endpoint** (single round-trip):

```
POST /api/v1/designs/from-prompt
Body: { prompt: string, conversationHistory?: Message[] }
Response: {
  analysis: PromptAnalysis,
  layouts: GeneratedLayout[],
  sessionId?: string
}
```

Implementation: chain `analyzeDesignPrompt` → `generateLayout` in `aiDesignController.js`.

**If skipping new endpoint:** frontend chains two existing calls — that's fine for v1.

**Enhance `analyzeDesignPrompt`** in `groqService.js` to also extract:
- `obstacles: string[]` (door, window, etc.)
- `mustHave: string[]` (desk, sofa, etc.)
- `budget: low|medium|high`

---

### Phase 4 — Deprecate wizard UI (keep as advanced option)

- **Default route:** chat experience
- **Optional:** "Manual setup" link in header → legacy step form (current Step 1–2) for power users
- Do not delete dimension validation logic — move to `AIDesignIntentCard` edit modal

---

### Phase 5 — Entry-point integration

| Source | Behavior |
|--------|----------|
| Home → AI Design | Open chat empty state |
| Theme Recommend → Apply | Pre-fill input: `"${themeName} theme for ${room}"` + theme colors in analysis context |
| Spatial Mapping → AI Design | Inject `roomData` dimensions/obstacles as **system context** in first message |
| Saved tab | Open chat with history or saved design id |

Handle `useLocalSearchParams()`:

```typescript
// theme-recommend passes themeName, themeColors
// spatial-mapping passes roomDataJson
useEffect(() => {
  if (params.themeName) {
    setInitialPrompt(`Design a ${params.themeName} inspired room`);
  }
  if (params.roomDataJson) {
    const room = JSON.parse(params.roomDataJson);
    // seed analysis.dimensions + obstacles
  }
}, [params]);
```

---

## API Payload Mapping (Chat → generateLayout)

After `analyzePrompt` returns:

```typescript
const body = {
  roomDimensions: {
    width: analysis.dimensions?.width ?? 4.5,
    height: analysis.dimensions?.height ?? 2.7,
    depth: analysis.dimensions?.length ?? 5.0,  // note: length → depth in API
  },
  detectedObstacles: analysis.obstacles ?? [],
  availableFloorSpace: width * depth * 0.75,
  roomType: analysis.roomType ?? 'Living Room',
  style: analysis.style ?? 'Modern',
};
await callApi('/design/generate', { method: 'POST', body, headers: auth });
```

**Auth:** `/design/generate` requires `authenticate` middleware — ensure user is logged in or use token from `AsyncStorage` (current pattern in `ai-design.tsx`).

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `frontend/app/ai-design.tsx` | Slim route → `AIDesignChatScreen` |
| `frontend/components/ai-design/*` | **Create** chat UI components |
| `frontend/hooks/useAIDesignChat.ts` | **Create** chat state machine |
| `frontend/hooks/useAIDesignGeneration.ts` | Integrate or delegate from chat hook |
| `frontend/services/IdeaAssistantService.ts` | Extend types if obstacles/mustHave added |
| `frontend/types/ai-design-chat.ts` | **Create** message + session types |
| `backend/src/controllers/aiDesignController.js` | Optional `fromPrompt` endpoint |
| `backend/src/services/groqService.js` | Optional richer `analyzeDesignPrompt` JSON |

## Files to Avoid Rewriting

- `FloorPlan2D.tsx` — reuse as-is inside layout cards
- `groqService` core API client
- AR View, spatial mapping, theme recommend (except navigation params)
- Entire `GenerativeAIDesignService` unless enriching proposals

---

## UX Details (ChatGPT / Gemini parity)

| Feature | Implementation |
|---------|----------------|
| Sticky input bar | `position: absolute` bottom or `KeyboardAvoidingView` |
| Auto-scroll on new message | `flatListRef.scrollToEnd()` |
| Typing indicator | `loading` message type with `ActivityIndicator` |
| Stop / cancel | Clear in-flight requests with `AbortController` |
| Copy prompt | Long-press user bubble (optional) |
| Regenerate | "Try again" on layout card → re-call generate |
| Empty state | Logo + 3 suggestion chips + short subtitle |
| Error recovery | Assistant bubble with retry button, not `Alert` only |

**Do not require** streaming for v1 — batch responses are OK. Add streaming later via Groq SSE if time permits.

---

## Acceptance Tests

1. Open AI Design → see chat empty state with suggestion chips
2. Type: *"Modern living room 5 meters by 4 meters"* → intent card shows correct parse → Generate → 3 layouts
3. Type vague: *"cozy bedroom"* → defaults applied (4.5×5×2.7) → still generates
4. Type: *"hi"* → assistant asks for more detail (no crash)
5. Switch between layout 1/2/3 → floor plan updates → image generates
6. Tap **Open in AR View** → passes `roomDataJson`
7. From Theme Recommend → chat opens with theme pre-filled
8. From Spatial Mapping → dimensions pre-filled from scan
9. Offline → friendly assistant error message
10. Android + iOS keyboard does not cover input bar

---

## Suggested Implementation Order

1. Create `types/ai-design-chat.ts` + `useAIDesignChat.ts` (state machine, no UI)
2. Build `AIDesignChatInput` + `AIDesignChatThread` + message bubbles
3. Wire `analyzePrompt` → intent card → `generateLayout`
4. Add `AIDesignLayoutCard` with `FloorPlan2D` + image gen
5. Replace `ai-design.tsx` body with chat screen
6. Wire theme/spatial entry params
7. Optional: backend `/designs/from-prompt`
8. Keep "Manual setup" as secondary entry
9. Device test + commit on `feature/ai-design-chat-flow`

Suggested commit message:

```
feat: redesign AI Design as conversational prompt-first chat flow

Replace multi-step dimension wizard with ChatGPT-style input that parses
natural language via Groq and generates layouts inline.
```

---

## Technical Constraints

- **`@/`** path alias
- **`useTheme()`** for all colors
- Decompose into `components/ai-design/` + `hooks/` — do not grow one 2000-line file
- Preserve `POST /design/generate` and `/ideas/analyze` contracts
- `GROQ_API_KEY` must be set on backend (already configured)
- Web: chat UI should work; AR handoff may be mobile-only

---

## What NOT to Do

- Do **not** remove backend layout generation — only change how frontend collects input
- Do **not** force users through dimension wizard as the only path
- Do **not** duplicate `IdeaAssistantService` with a parallel parser
- Do **not** break auth on `/design/generate`
- Do **not** commit API keys

---

## Reference Docs

- `frontend/REFACTORING_SUMMARY.md` — prior AI design modularization
- `ANTIGRAVITY_GROQ_COMMIT_INTEGRATION_PROMPT.md` — Groq backend context
- `ANTIGRAVITY_INTERIOR_IMAGE_FILTER_PROMPT.md` — image quality for previews
- `.cursor/rules/ar-interior-design-app.mdc` — project conventions

**Start by reading:** `frontend/app/ai-design.tsx`, `frontend/services/IdeaAssistantService.ts`, `backend/src/controllers/ideaAssistantController.js`

**Deliverable:** AI Design screen that works like **ChatGPT for interior design** — type a prompt, get parsed intent + layouts + images in a chat thread.
