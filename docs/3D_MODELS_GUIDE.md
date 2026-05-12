# 3D Furniture Models Guide

## 🎯 Quick Start (5 Minutes)

### Option 1: Use Free Online Models (Easiest)

1. **Go to Poly Haven**: https://polyhaven.com/models
2. Search for "sofa", "chair", "table", etc.
3. Download GLB format
4. Upload to your server/CDN
5. Update URLs in `FurnitureModelLoader.ts`

### Option 2: Use Sketchfab Free Models

1. Go to: https://sketchfab.com
2. Filter by: **License: CC0 or CC-BY**
3. Search for furniture
4. Download GLB format
5. Add URLs to `FURNITURE_MODEL_URLS` in `FurnitureModelLoader.ts`

### Option 3: Use Box Geometry (Current - Works Now!)

The system already works with box geometry. 3D models are optional enhancement.

---

## 📦 Free 3D Model Sources

### 1. **Poly Haven** (Recommended - CC0 License)
- URL: https://polyhaven.com/models
- License: CC0 (Public Domain)
- Formats: GLB, GLTF, OBJ
- Quality: High
- **Best for**: Professional models

### 2. **Sketchfab** (Large Collection)
- URL: https://sketchfab.com
- License: Filter by CC0/CC-BY
- Formats: GLB, GLTF
- Quality: Varies
- **Best for**: Variety

### 3. **Free3D**
- URL: https://free3d.com
- License: Various (check per model)
- Formats: OBJ, FBX, GLB
- Quality: Varies
- **Best for**: Quick downloads

### 4. **TurboSquid Free**
- URL: https://www.turbosquid.com/Search/3D-Models/free
- License: Check per model
- Formats: Various
- Quality: Good
- **Best for**: Commercial-ready models

### 5. **Google Poly Archive** (via Internet Archive)
- URL: https://archive.org/details/poly
- License: CC-BY
- Formats: OBJ, GLTF
- Quality: Good
- **Best for**: Retro/vintage models

---

## 🚀 Quick Setup Steps

### Step 1: Download Models

1. Visit Poly Haven: https://polyhaven.com/models
2. Download these items:
   - Sofa (search "sofa" or "couch")
   - Coffee Table
   - Chair
   - Lamp
   - Bookshelf
   - Planter

### Step 2: Host Models

**Option A: Use GitHub (Free)**
```bash
# Create a new GitHub repo
# Upload GLB files
# Use raw.githubusercontent.com URLs
```

**Option B: Use Cloud Storage**
- Google Cloud Storage
- AWS S3
- Cloudinary
- Firebase Storage

**Option C: Local Assets (For Development)**
```bash
# Place models in: ARInteriorDesinApp/assets/models/
# Use require() or local paths
```

### Step 3: Update URLs

Edit `ARInteriorDesinApp/services/FurnitureModelLoader.ts`:

```typescript
const FURNITURE_MODEL_URLS: Record<string, string> = {
  'sofa-modern': 'YOUR_URL_HERE',
  'coffee-table': 'YOUR_URL_HERE',
  // ... etc
};
```

---

## 📝 Model Requirements

### File Format
- **Preferred**: GLB (binary GLTF - single file)
- **Alternative**: GLTF (JSON + bin + textures)

### Size Guidelines
- **Target**: < 5MB per model
- **Maximum**: < 10MB per model
- **Optimize**: Use Blender or online tools to reduce size

### Model Specifications
- **Scale**: Models will be auto-scaled to match dimensions
- **Origin**: Should be at bottom center (0, 0, 0)
- **Rotation**: Y-up is standard
- **Textures**: Embedded in GLB or separate files

---

## 🛠️ Model Optimization

### Using Blender (Free)

1. Download Blender: https://www.blender.org
2. Import your model
3. **Reduce polygons**: Modifier → Decimate
4. **Export as GLB**: File → Export → glTF 2.0
5. Select "glTF Binary (.glb)"
6. Check "Selected Objects Only"
7. Click "Export glTF 2.0"

### Online Tools

- **glTF-Pipeline**: https://github.com/CesiumGS/gltf-pipeline
- **Draco Compression**: Reduces file size by 50-90%
- **Online GLB Optimizer**: Search "glb optimizer online"

---

## 🔧 Integration with AR View

The `FurnitureModelLoader` service is already integrated. Models will automatically load when:

1. Furniture is placed in AR view
2. Layout is loaded
3. Models are preloaded

### Fallback Behavior

If a model fails to load:
- ✅ System automatically uses box geometry
- ✅ No errors or crashes
- ✅ App continues to work normally

---

## 📋 Quick Model URLs (Ready to Use)

### Using Public CDN (Temporary - Replace with Your Own)

```typescript
// These are placeholder URLs - replace with your actual models
const FURNITURE_MODEL_URLS = {
  'sofa-modern': 'https://your-cdn.com/models/sofa.glb',
  'coffee-table': 'https://your-cdn.com/models/table.glb',
  // etc...
};
```

### Using Local Assets (React Native)

```typescript
// For local assets in React Native/Expo
const FURNITURE_MODEL_URLS = {
  'sofa-modern': require('@/assets/models/sofa.glb'),
  // etc...
};
```

---

## ✅ Checklist

- [ ] Download 6+ furniture models (sofa, table, chair, lamp, shelf, planter)
- [ ] Convert to GLB format if needed
- [ ] Optimize models (< 5MB each)
- [ ] Upload to hosting/CDN
- [ ] Update URLs in `FurnitureModelLoader.ts`
- [ ] Test model loading in AR view
- [ ] Verify fallback to boxes works

---

## 🆘 Troubleshooting

### Models Not Loading?

1. **Check URL**: Make sure URLs are accessible (test in browser)
2. **Check CORS**: Server must allow cross-origin requests
3. **Check Format**: Must be GLB or GLTF
4. **Check Console**: Look for error messages
5. **Use Fallback**: System will use boxes automatically

### Models Too Large?

1. Use Blender to reduce polygons
2. Compress textures
3. Use Draco compression
4. Consider lower quality models for mobile

### Models Not Scaling Correctly?

1. Models are auto-scaled to match dimensions
2. Check model origin (should be at bottom)
3. Adjust `scale` in `MODEL_CONFIGS` if needed

---

## 🎓 For Your Thesis/Demo

### What to Say:

> "The system supports both 3D models and procedural geometry. For the demo, we're using optimized GLB models from Poly Haven (CC0 license). The system gracefully falls back to procedural boxes if models fail to load, ensuring reliability."

### Demo Tips:

1. **Show both**: Box geometry (works now) + 3D models (enhancement)
2. **Explain fallback**: System is robust and handles failures
3. **Mention optimization**: Models are optimized for mobile performance

---

## 📞 Need Help?

- Check console logs for errors
- Test URLs in browser first
- Start with 1-2 models, then add more
- Use box geometry for demo if models aren't ready

**Remember**: Box geometry works perfectly fine for your demo! 3D models are a nice-to-have enhancement.











