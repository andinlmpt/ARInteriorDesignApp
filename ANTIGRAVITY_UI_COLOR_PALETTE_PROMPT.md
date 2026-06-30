# Antigravity Prompt: Minimalist Interior Design UI Color Palette

Act as a senior UI/UX + React Native developer working on **AR Interior Design App**. Your job is to apply the **official color palette below** across the entire mobile app — minimalist, warm, and aesthetic — matching an interior design brand. Use **`useTheme()`** everywhere; remove legacy blue/purple tech colors.

---

## Official Reference Palette (USE THIS — do not substitute)

This is the **approved design reference** from the product owner:

| Role | Name | Hex | Maps to token |
|------|------|-----|----------------|
| Background | Warm Ivory | `#FAF9F7` | `background` |
| Surface / Cards | Pure White | `#FFFFFF` | `surfacePrimary`, `card` |
| Secondary Surface | Soft Linen | `#F2F1EE` | `surfaceSecondary`, `hover` |
| Primary | Muted Sage | `#7A8F7B` | `accent` — buttons, active tab, links |
| Primary (Dark) | Deep Sage | `#617364` | `accentDark` — pressed CTA |
| Accent | Natural Sand | `#CDB9A6` | `accentLight` — highlights, secondary chips |
| Text | Soft Black | `#1F1F1F` | `textPrimary`, `primary` |
| Secondary Text | Stone Gray | `#7A7A78` | `textSecondary`, `secondary` |
| Border / Divider | Mist Gray | `#E6E4E1` | `border`, `line` |
| Success | Moss Green | `#6F8B62` | `success`, `green` |
| Warning | Soft Gold | `#D7B26A` | `warning`, `orange` |
| Error | Muted Clay | `#C77A6A` | `danger` |

### Derived tokens (not in reference table — compute from above)

| Token | Hex | Rule |
|-------|-----|------|
| `surfaceTertiary` | `#E6E4E1` | Same as Mist Gray — input/chip backgrounds |
| `accentSoft` | `#F0EBE4` | Natural Sand at ~15% on white — icon pills, selected chips |
| `textMuted` | `#9A9A98` | Lighter than Stone Gray — placeholders |
| `outline` | `#D4D2CF` | Slightly darker than Mist Gray — input borders |
| `overlay` | `rgba(31, 31, 31, 0.72)` | Modals |
| `gradientStart` | `#7A8F7B` | Muted Sage |
| `gradientEnd` | `#617364` | Deep Sage — **no purple gradients** |

### Dark mode (derive — warm, not cold black)

| Token | Hex |
|-------|-----|
| `background` | `#1C1B19` |
| `surfacePrimary` | `#262422` |
| `surfaceSecondary` | `#1C1B19` |
| `surfaceTertiary` | `#2E2C28` |
| `accent` | `#9AAD9B` |
| `accentLight` | `#CDB9A6` |
| `accentDark` | `#7A8F7B` |
| `accentSoft` | `#9AAD9B18` |
| `textPrimary` | `#FAF9F7` |
| `textSecondary` | `#B8B6B2` |
| `textMuted` | `#8A8885` |
| `border` | `#3A3835` |
| `outline` | `#4A4844` |
| `success` | `#7FA872` |
| `warning` | `#E0C07E` |
| `danger` | `#D49084` |
| `overlay` | `rgba(0, 0, 0, 0.82)` |
| `gradientStart` | `#9AAD9B` |
| `gradientEnd` | `#617364` |

### Home screen legacy keys (map to palette — no rainbow)

| Key | Use |
|-----|-----|
| `pink` | `#CDB9A6` (Natural Sand) |
| `purple` | `#7A8F7B` (Muted Sage) |
| `green` | `#6F8B62` |
| `orange` | `#D7B26A` |
| `muted` | `#9A9A98` |

---

## Product Goal

> The app should feel like a **premium interior design studio** — warm ivory walls, sage greenery, sand accents. Room photos and 3D renders are the hero; UI chrome stays quiet.

**Success criteria:**
- All tabs use Warm Ivory + Muted Sage + Natural Sand
- **No** `#3B82F6`, `#0A84FF`, `#667EEA`, `#764BA2`
- Single source of truth: `frontend/theme/palette.ts`
- `ThemeContext` + `components/ui/theme.ts` import from palette only
- High-traffic screens migrated off hardcoded hex
- Splash / adaptive icon: `#FAF9F7`

---

## Step 0 — Audit

```powershell
cd frontend

rg "#3[Bb]82[Ff]6|#667EEA|#764BA2|#0A84FF|#007AFF" --glob "*.{tsx,ts}"

rg "backgroundColor: '#|color: '#" --glob "*.{tsx,ts}" | head -60

git checkout -b feature/warm-ivory-palette
```

---

## Implementation Plan

### Phase 1 — `frontend/theme/palette.ts` (create or replace)

```typescript
export const lightPalette = {
  background: '#FAF9F7',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F2F1EE',
  surfaceTertiary: '#E6E4E1',
  accent: '#7A8F7B',
  accentLight: '#CDB9A6',
  accentDark: '#617364',
  accentSoft: '#F0EBE4',
  success: '#6F8B62',
  warning: '#D7B26A',
  danger: '#C77A6A',
  textPrimary: '#1F1F1F',
  textSecondary: '#7A7A78',
  textMuted: '#9A9A98',
  border: '#E6E4E1',
  outline: '#D4D2CF',
  overlay: 'rgba(31, 31, 31, 0.72)',
  gradientStart: '#7A8F7B',
  gradientEnd: '#617364',
  card: '#FFFFFF',
  hover: '#F2F1EE',
  line: '#E6E4E1',
  primary: '#1F1F1F',
  secondary: '#7A7A78',
  muted: '#9A9A98',
  green: '#6F8B62',
  orange: '#D7B26A',
  pink: '#CDB9A6',
  purple: '#7A8F7B',
} as const;

// darkPalette — use dark mode table above
export const darkPalette = { /* ... */ } as const;

export type AppPalette = typeof lightPalette;
export const lightColors = lightPalette;
export const darkColors = darkPalette;
```

### Phase 2 — Wire theme system

| File | Action |
|------|--------|
| `contexts/ThemeContext.tsx` | `import { lightPalette, darkPalette } from '@/theme/palette'` — delete inline hex |
| `components/ui/theme.ts` | Re-export palette; `shadowColor: '#1F1F1F'` |
| `app.config.js` | `splash.backgroundColor` + `android.adaptiveIcon.backgroundColor` → `#FAF9F7` |

### Phase 3 — Screens (priority)

| Priority | File |
|----------|------|
| 1 | `app/(tabs)/index.tsx` — feature tiles use sage/sand, not rainbow |
| 2 | `app/(tabs)/_layout.tsx` — tab bar |
| 3 | `app/(tabs)/explore.tsx` |
| 4 | `app/ai-design.tsx` — remove hardcoded blues in StyleSheet |
| 5 | `app/theme-recommend.styles.ts` → `createThemeRecommendStyles(colors)` |
| 6 | `app/login.tsx`, `app/signup.tsx` |
| 7 | `app/spatial-mapping.tsx`, `app/live-scan.tsx` |
| 8 | `styles/arView.styles.ts` |

**Static stylesheet pattern:**

```typescript
export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { backgroundColor: colors.background },
    primaryButton: { backgroundColor: colors.accent },
  });
```

### Phase 4 — Component rules

- **Primary button:** `accent` (`#7A8F7B`) bg, white or `#FAF9F7` text
- **Secondary button:** `accentSoft` bg, `accentDark` text
- **Cards:** `surfacePrimary`, border `border`, `shadows.sm`
- **Active tab:** `accent` tint, `accentSoft` icon pill
- **Do not change** `FloorPlan2D` furniture colors or theme recommendation swatches (user content)

---

## Files to modify

| File | Action |
|------|--------|
| `frontend/theme/palette.ts` | **Create** — official palette |
| `frontend/contexts/ThemeContext.tsx` | Import palette |
| `frontend/components/ui/theme.ts` | Re-export |
| `frontend/app.config.js` | Splash `#FAF9F7` |
| High-traffic screens listed above | Remove hardcoded hex |

## Do NOT change

- `FloorPlan2D.tsx` layout colors
- Backend
- `types/theme-recommendation.ts` user theme palettes

---

## Acceptance tests

1. Light mode: warm ivory background `#FAF9F7`, sage buttons `#7A8F7B`
2. Dark mode toggle — warm charcoal, lighter sage accent
3. No blue tab icons or purple gradients anywhere
4. Home feature grid — unified sage/sand (not pink/purple/orange mix)
5. Explore room photos pop against neutral UI
6. iOS + Android + web smoke test

---

## Commit message

```
feat: apply Warm Ivory & Muted Sage interior design palette

Official reference palette with sage primary, sand accent, and warm
neutrals. Single source of truth in frontend/theme/palette.ts.
```

---

## Reference image (product owner approved)

```
Background       Warm Ivory      #FAF9F7
Surface/Cards    Pure White      #FFFFFF
Secondary        Soft Linen      #F2F1EE
Primary          Muted Sage      #7A8F7B
Primary Dark     Deep Sage       #617364
Accent           Natural Sand    #CDB9A6
Text             Soft Black      #1F1F1F
Secondary Text   Stone Gray      #7A7A78
Border           Mist Gray       #E6E4E1
Success          Moss Green      #6F8B62
Warning          Soft Gold       #D7B26A
Error            Muted Clay      #C77A6A
```

**Start by:** creating `frontend/theme/palette.ts` with the table above, then wiring `ThemeContext.tsx`.

**Deliverable:** Full app uses the official palette; audit shows no legacy blue/purple brand colors.
