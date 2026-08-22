# Furniture GLB drop folder

Put `.glb` files here (subfolders are OK: `Sofa/`, `love seats/`, `accent chairs/`).

Then in Unity:

1. Wait until the Project window shows the models (no spinning import).
2. Open **ARDesignScene**.
3. Menu: **AR Interior → AR Design → Import Downloaded GLB Furniture**
4. That bakes **mobile** copies into `Assets/_App/Furniture/Resources/Furniture/` (textures capped at 1024px).
5. **File → Build And Run** again.

Do **not** assign the original 70–80 MB GLBs onto the scene catalog. That loads ~1.2 GB at startup and the Android app goes black after the Unity logo.
