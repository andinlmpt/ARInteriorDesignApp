# AR Setup in InteriorDesignViewer — Step by Step

Use this guide inside your **existing** Unity project:

`D:\project\ARInteriorDesignApp-main\InteriorDesignViewer`

## Recommended: one scene, AR only (IKEA-style furniture in real room)

If you only want **furniture rendered in your real room** inside the Expo **AR View** tab:

| What | Do you need it? |
|------|-----------------|
| **One Unity scene** (`ARFurniture`) | ✅ Yes |
| **Native Android/iOS Unity build** | ✅ Yes |
| **Layout 3D + WebView + WebGL** | ❌ No |
| **`npm run serve:unity` / `index.html`** | ❌ No |
| **`SampleScene` / `RoomManager` / `WebGLBridge`** | ❌ No (legacy preview path) |

**Expo screens:**

| Screen | Purpose | Unity needed? |
|--------|---------|---------------|
| **AR View** (`/ar-view`) | Place furniture in real room | ✅ Native Unity + AR Foundation |
| **Layout 3D** (`/layout-3d`) | Virtual room editor (top-down / perspective) | ❌ Optional — Three.js already works without Unity |

You can ignore Layout 3D entirely unless you want a separate **virtual room planner** (not live AR).

AR scripts are already in the repo:

- `Assets/Scripts/AR/ARFurniturePlacer.cs`
- `Assets/Scripts/AR/UnityMessageBridge.cs`
- `Assets/Scripts/AR/FurnitureCatalog.cs`

---

## Optional: two scenes (only if you want both AR + WebGL preview)

Only use this if you later want Unity in **Layout 3D** WebView **and** AR View:

| Scene | Build | Used for |
|-------|-------|----------|
| `SampleScene` (existing) | WebGL | Layout 3D in Expo WebView |
| `ARFurniture` (new) | Android / iOS | IKEA-style AR on phone |

**Skip this section** if AR View is your only Unity use case.

---

## Part 1 — Install Unity Hub modules (one time)

1. Open **Unity Hub**.
2. Click **Installs**.
3. Click the **gear** on **Unity 6** (your version: `6000.5.1f1`) → **Add modules**.
4. Check:
   - **Android Build Support**
   - **Android SDK & NDK Tools**
   - **OpenJDK**
   - **Web Build Support** (you already use this)
5. Click **Continue** and wait for download (~5–8 GB).

> iOS AR needs a Mac + **iOS Build Support**. Skip for now if you only have Android.

---

## Part 2 — Open InteriorDesignViewer

1. Unity Hub → **Projects** → **Open**.
2. Select folder: `D:\project\ARInteriorDesignApp-main\InteriorDesignViewer`.
3. Wait for Unity to compile scripts (first open may take a few minutes).

---

## Part 3 — Install AR packages (Package Manager)

1. In Unity menu: **Window → Package Manager**.
2. Top-left dropdown: change to **Unity Registry**.
3. Install these packages **one at a time** (click package → **Install**):

| # | Package name | What it does |
|---|--------------|--------------|
| 1 | **XR Plugin Management** | Enables ARKit / ARCore toggles |
| 2 | **AR Foundation** | Cross-platform AR API |
| 3 | **ARCore XR Plugin** | Android AR |
| 4 | **ARKit XR Plugin** | iOS AR (optional) |

4. If Unity asks to install **Input System** — click **Yes** (you already have it).
5. Wait until all four show **Installed** in the left list.

**Can't find "XR" menu?** AR Foundation is not installed yet — finish step 3 first.

---

## Part 4 — Enable ARCore (XR Plug-in Management)

1. **Edit → Project Settings**.
2. Left sidebar: **XR Plug-in Management**.
3. If you see **Install XR Plug-in Management** — click it first.
4. Click the **Android** tab (Android robot icon).
5. Check **ARCore** ✅.
6. Click **iOS** tab → check **ARKit** ✅ (only if you will build for iPhone).
7. Leave **Standalone** (PC) tab empty.

---

## Part 5 — Android Player settings

Still in **Project Settings**:

1. Left sidebar: **Player**.
2. Click the **Android** tab (robot icon).
3. Under **Other Settings**:

| Setting | Value |
|---------|--------|
| **Minimum API Level** | Android 7.0 (API 24) or higher |
| **Scripting Backend** | IL2CPP |
| **Target Architectures** | ARM64 ✅ |

4. Close Project Settings.

---

## Part 6 — Create the ARFurniture scene

### 6.1 New scene

1. **File → New Scene**.
2. Choose **Basic (URP)** (or **Empty** if that's all you see).
3. **File → Save As…**
4. Save to: `Assets/Scenes/ARFurniture.unity`

### 6.2 Add XR Origin (camera rig)

1. **GameObject → XR → XR Origin (Mobile AR)**.
   - If this menu is missing: AR Foundation is not installed — go back to Part 3.

2. Your Hierarchy should now look like:

```
ARFurniture
├── XR Origin
│   ├── Camera Offset
│   │   └── Main Camera
│   └── (other children)
├── Directional Light   ← you can delete this later
└── Global Volume       ← optional, can keep
```

3. Select **Main Camera** (under XR Origin → Camera Offset).
4. In Inspector, confirm these components exist:
   - **Camera**
   - **AR Camera Manager**
   - **AR Camera Background**

### 6.3 Add AR Session

1. **GameObject → XR → AR Session**.
2. AR Session appears as a root object in Hierarchy.
3. Leave default settings on the **AR Session** component.

### 6.4 Add plane detection

1. Select **XR Origin** in Hierarchy.
2. Inspector → **Add Component** → search **AR Plane Manager** → add it.
3. On **AR Plane Manager**:
   - **Detection Mode**: `Horizontal` (floor only — good for furniture)
   - **Plane Prefab**: leave empty for now (Unity uses a default debug plane)

### 6.5 Add raycast manager

1. Still on **XR Origin**.
2. **Add Component** → **AR Raycast Manager**.

---

## Part 7 — Wire up scripts (Managers object)

### 7.1 Create Managers

1. **GameObject → Create Empty**.
2. Rename it to `Managers`.
3. With `Managers` selected, **Add Component**:
   - `ARFurniture Placer`
   - `Unity Message Bridge`
   - `Furniture Catalog`

### 7.2 Create furniture parent

1. **GameObject → Create Empty** → rename `FurnitureRoot`.
2. Leave at position (0, 0, 0).

### 7.3 Create placement indicator

1. **GameObject → 3D Object → Cylinder**.
2. Rename to `PlacementIndicator`.
3. In Inspector **Transform**:
   - Position: (0, 0, 0)
   - Scale: (0.15, 0.01, 0.15)
4. Optional: create a cyan semi-transparent material so you can see it on the floor.

### 7.4 Create a test furniture prefab (cube sofa)

1. **GameObject → 3D Object → Cube**.
2. Rename to `TestSofa`.
3. Scale: (1.5, 0.5, 0.8) — roughly sofa size in meters.
4. Position Y: `0.25` (half height so bottom sits on floor).
5. Drag `TestSofa` from Hierarchy into `Assets/Prefabs/` (create **Prefabs** folder if needed).
6. Delete `TestSofa` from the scene (keep the prefab in Project).

### 7.5 Connect Inspector references

Select **Managers** in Hierarchy. Wire these fields:

**ARFurniture Placer:**

| Field | Drag from Hierarchy |
|-------|---------------------|
| Raycast Manager | XR Origin |
| Plane Manager | XR Origin |
| Placement Indicator | PlacementIndicator |
| Furniture Parent | FurnitureRoot |

**Unity Message Bridge:**

| Field | Drag from |
|-------|-----------|
| Placer | Managers (same object) |
| Catalog | Managers (same object) |

**Furniture Catalog:**

| Field | Value |
|-------|--------|
| Entries → Size | 1 |
| Element 0 → Id | `test-sofa` |
| Element 0 → Prefab | TestSofa prefab |
| Default Prefab | TestSofa prefab |

### 7.6 Set active prefab for testing

Select **Managers** → on **ARFurniture Placer**, you can also call `SetPrefab` from code. For first test, the catalog default prefab is enough — we'll trigger placement via a small test script or ReceiveMessage.

**Quick test without React Native:** Add this temporary line in `ARFurniturePlacer.SetPrefab` call from `UnityMessageBridge.Start`:

In Play mode, send a test message from another script, OR temporarily add to `UnityMessageBridge.Start()` after `SendToApp`:

```csharp
if (catalog != null && placer != null)
{
    placer.SetPrefab(catalog.GetPrefab("test-sofa"));
}
```

(Remove after AR placement works.)

---

## Part 8 — Add scene to Build Settings

**AR-only (recommended):**

1. **File → Build Profiles**.
2. Click **Add Open Scenes** (with `ARFurniture` open).
3. **Only** `ARFurniture` should be in the build list for Android/iOS.
4. You do **not** need WebGL builds or `SampleScene` for furniture AR.

**Optional (WebGL + AR):** also add `SampleScene` if you keep Layout 3D Unity toggle.

---

## Part 9 — Test on Android phone

### 9.1 Switch platform

1. **File → Build Profiles**.
2. Select **Android** → **Switch Platform** (first time: 10–20 minutes).

### 9.2 Build and run

1. Connect Android phone via USB.
2. Enable **Developer options** + **USB debugging** on phone.
3. In Build Profiles: **Build And Run**.
4. Save APK somewhere (e.g. `InteriorDesignViewer/Builds/Android/`).

### 9.3 What you should see

1. App opens → camera permission prompt → allow.
2. Point phone at floor — white/grid planes may appear (debug visualization).
3. Cyan cylinder (placement indicator) appears at screen center when floor is detected.
4. Tap screen → cube sofa appears on the floor.

**If camera is black:** ARCore not enabled, or device doesn't support ARCore.

**If nothing places on tap:** Check Managers references in Inspector.

---

## Part 10 — Share assets (one catalog for AR)

Use one folder for furniture prefabs:

```
Assets/
├── Models/Furniture/     ← GLB / FBX imports
├── Prefabs/Furniture/    ← Sofa.prefab, Table.prefab
├── Materials/            ← URP Lit materials
├── Scenes/
│   └── ARFurniture.unity ← your only scene (AR)
└── Scripts/
    └── AR/               ← ARFurniturePlacer, UnityMessageBridge, FurnitureCatalog
```

**Workflow:**

1. Import GLB into `Models/Furniture/`.
2. Fix materials: **Edit → Rendering → Materials → Convert Selected Materials to URP**.
3. Drag model into scene, fix scale (1 Unity unit = 1 meter).
4. Make prefab in `Prefabs/Furniture/`.
5. Add prefab to **Furniture Catalog** entries (match IDs with `frontend/constants/furniture-library.ts`).

You do **not** need `RoomManager` or `WebGLBridge` for AR-only.

---

## Part 11 — WebGL / Layout 3D (skip for AR-only)

If you are **not** using Unity in Layout 3D:

- Ignore WebGL build target and `npm run serve:unity`.
- Layout 3D can keep using **Three.js** (`expo-gl`) — it already works without Unity.
- Or hide/remove the Layout 3D screen from the app if you do not need virtual room editing.

---

## Checklist

- [ ] Android Build Support installed in Unity Hub
- [ ] AR Foundation + ARCore packages installed
- [ ] ARCore enabled under XR Plug-in Management → Android
- [ ] Scene `ARFurniture.unity` created
- [ ] XR Origin + AR Session in scene
- [ ] AR Plane Manager + AR Raycast Manager on XR Origin
- [ ] Managers wired with scripts + references
- [ ] Test prefab in Furniture Catalog
- [ ] Android Build And Run → cube places on real floor

---

## Next step

When cube placement works on your phone, continue with:

- [UNITY_AR_IKEA_STYLE.md](./UNITY_AR_IKEA_STYLE.md) — Phase F (export for React Native) and Phase G (`@azesmway/react-native-unity`)

---

*Unity version: 6000.5.1f1 | Project: InteriorDesignViewer*
