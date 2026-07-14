using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Manages switching between Furniture Mode and Wall Paint Mode in the AR scene.
/// Toggles plane detection mode, UI panels, and visibility of horizontal vs. vertical planes.
/// </summary>
public class ARModeSwitcher : MonoBehaviour
{
    public enum ARMode { Furniture, WallPaint }

    [Header("AR References")]
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARFurniturePlacer furniturePlacer;
    [SerializeField] private ARFurnitureGestureController gestureController;
    [SerializeField] private WallSelector wallSelector;
    [SerializeField] private WallPainter wallPainter;

    [Header("UI Panels")]
    [SerializeField] private GameObject furnitureUIPanel;
    [SerializeField] private GameObject wallPaintUIPanel;
    [SerializeField] private ARFurniturePickerUI furniturePickerUI;
    [SerializeField] private ColorPickerUIController colorPickerController;

    private ARMode currentMode = ARMode.Furniture;
    public ARMode CurrentMode => currentMode;

    void Awake()
    {
        // Try to automatically find references if not manually set in the inspector
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (furniturePlacer == null) furniturePlacer = FindFirstObjectByType<ARFurniturePlacer>();
        if (gestureController == null) gestureController = FindFirstObjectByType<ARFurnitureGestureController>();
        if (wallSelector == null) wallSelector = FindFirstObjectByType<WallSelector>();
        if (wallPainter == null) wallPainter = FindFirstObjectByType<WallPainter>();
        if (furniturePickerUI == null) furniturePickerUI = FindFirstObjectByType<ARFurniturePickerUI>();
        if (colorPickerController == null) colorPickerController = FindFirstObjectByType<ColorPickerUIController>();
    }

    void OnEnable()
    {
        if (planeManager != null)
        {
            planeManager.planesChanged += OnPlanesChanged;
        }
    }

    void OnDisable()
    {
        if (planeManager != null)
        {
            planeManager.planesChanged -= OnPlanesChanged;
        }
    }

    void Start()
    {
        // Default to Furniture Mode on startup
        SetMode(ARMode.Furniture);
    }

    /// <summary>
    /// Switch to Furniture Placement Mode.
    /// </summary>
    public void SwitchToFurnitureMode() => SetMode(ARMode.Furniture);

    /// <summary>
    /// Switch to Wall Paint Mode.
    /// </summary>
    public void SwitchToWallPaintMode() => SetMode(ARMode.WallPaint);

    /// <summary>
    /// Configures the active mode, toggling plane detection, UI, and active scripts.
    /// </summary>
    public void SetMode(ARMode mode)
    {
        currentMode = mode;
        Debug.Log($"[ARModeSwitcher] Switching mode to: {mode}");

        bool isFurniture = (mode == ARMode.Furniture);

        // Update AR plane detection settings dynamically (no session reset)
        if (planeManager != null)
        {
            // Note: In URP/AR Foundation, setting this will tell the underlying trackable provider
            // to stop/start scanning for specific alignments.
            planeManager.requestedDetectionMode = isFurniture 
                ? PlaneDetectionMode.Horizontal 
                : PlaneDetectionMode.Vertical;
        }

        // Toggle active controllers to prevent unwanted placements or selections
        if (furniturePlacer != null) furniturePlacer.enabled = isFurniture;
        if (gestureController != null) gestureController.enabled = isFurniture;
        if (wallSelector != null) wallSelector.enabled = !isFurniture;

        // Toggle UI layouts
        if (furnitureUIPanel != null) furnitureUIPanel.SetActive(isFurniture);
        if (wallPaintUIPanel != null) wallPaintUIPanel.SetActive(!isFurniture);

        // Hide/Show programmatically generated furniture bottom panel
        if (furniturePickerUI != null) furniturePickerUI.SetVisible(isFurniture);
        
        // Enable/Disable color picker script (which toggles its OnGUI/Canvas layout)
        if (colorPickerController != null) colorPickerController.enabled = !isFurniture;

        // Refresh visibility of currently tracked planes
        UpdatePlanesVisibility();
    }

    private void OnPlanesChanged(ARPlanesChangedEventArgs args)
    {
        bool isFurniture = (currentMode == ARMode.Furniture);
        
        // Ensure new planes immediately conform to the current mode's visibility rules
        foreach (var plane in args.added)
        {
            ApplyPlaneVisibility(plane, isFurniture);
        }
    }

    private void UpdatePlanesVisibility()
    {
        if (planeManager == null) return;

        bool isFurniture = (currentMode == ARMode.Furniture);
        foreach (var plane in planeManager.trackables)
        {
            ApplyPlaneVisibility(plane, isFurniture);
        }
    }

    private void ApplyPlaneVisibility(ARPlane plane, bool isFurnitureMode)
    {
        bool shouldBeVisible = false;

        if (isFurnitureMode)
        {
            // Show floor/horizontal planes, hide wall/vertical planes
            shouldBeVisible = (plane.alignment == PlaneAlignment.HorizontalUp || 
                               plane.alignment == PlaneAlignment.HorizontalDown);
        }
        else
        {
            // Show wall/vertical planes, hide floor/horizontal planes
            shouldBeVisible = (plane.alignment == PlaneAlignment.Vertical);
        }

        SetPlaneVisibility(plane, shouldBeVisible);
    }

    private void SetPlaneVisibility(ARPlane plane, bool visible)
    {
        var renderers = plane.GetComponentsInChildren<Renderer>(true);
        foreach (var r in renderers)
        {
            // Special rule: If a wall has already been painted, keep its mesh renderer enabled
            // in both modes so the painted color is always visible.
            if (wallPainter != null && wallPainter.IsPlanePainted(plane) && r is MeshRenderer)
            {
                r.enabled = true;
            }
            else
            {
                r.enabled = visible;
            }
        }

        // Enable/Disable boundary line renderers
        var lineRenderers = plane.GetComponentsInChildren<LineRenderer>(true);
        foreach (var lr in lineRenderers)
        {
            lr.enabled = visible;
        }

        // IMPORTANT: Colliders must remain enabled on vertical planes in WallPaint mode
        // so that ARRaycastManager can detect taps against wall surfaces.
        bool isVertical = (plane.alignment == PlaneAlignment.Vertical);
        bool keepCollider = visible || (isVertical && currentMode == ARMode.WallPaint);

        var colliders = plane.GetComponentsInChildren<Collider>(true);
        foreach (var c in colliders)
        {
            c.enabled = keepCollider;
        }
    }

    void OnGUI()
    {
        // Simple GUI fallback for testing if no UI panel references are assigned
        if (furnitureUIPanel == null && wallPaintUIPanel == null)
        {
            // Determine dynamic sizes based on screen width for responsive layout
            float panelWidth = Mathf.Clamp(Screen.width * 0.6f, 300f, 650f);
            float panelHeight = Mathf.Clamp(Screen.width * 0.22f, 130f, 260f);
            int fontSize = Mathf.Max(14, Mathf.RoundToInt(panelWidth * 0.055f));

            // Set skin font sizes
            GUI.skin.label.fontSize = fontSize;
            GUI.skin.button.fontSize = fontSize;
            GUI.skin.box.fontSize = fontSize;

            GUILayout.BeginArea(new Rect(30, 30, panelWidth, panelHeight));
            GUILayout.BeginVertical("box");
            
            GUILayout.Label($"<b>AR Mode: {currentMode}</b>", GUILayout.ExpandWidth(true));
            
            float btnHeight = panelHeight * 0.45f;
            if (currentMode == ARMode.Furniture)
            {
                if (GUILayout.Button("Switch to Wall Paint Mode", GUILayout.Height(btnHeight)))
                {
                    SetMode(ARMode.WallPaint);
                }
            }
            else
            {
                if (GUILayout.Button("Switch to Furniture Mode", GUILayout.Height(btnHeight)))
                {
                    SetMode(ARMode.Furniture);
                }
            }
            
            GUILayout.EndVertical();
            GUILayout.EndArea();
        }
    }
}
