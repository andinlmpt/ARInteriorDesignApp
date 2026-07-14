using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Connects user clicks on color swatches to the WallPainter script to repaint selected walls.
/// Displays when a wall is selected, and hides on close/deselect.
/// </summary>
public class ColorPickerUIController : MonoBehaviour
{
    [Header("Script References")]
    [SerializeField] private WallSelector wallSelector;
    [SerializeField] private WallPainter wallPainter;
    
    [Header("UI References")]
    [SerializeField] private GameObject uiPanel;
    [SerializeField] private Button[] presetButtons;
    [SerializeField] private Button resetButton;
    [SerializeField] private Button closeButton;

    [Header("Preset Colors")]
    [SerializeField] private Color[] presetColors = new Color[]
    {
        Color.white,
        new Color(0.96f, 0.95f, 0.90f), // Beige
        new Color(0.85f, 0.85f, 0.85f), // Light Gray
        new Color(0.68f, 0.85f, 0.90f), // Sky Blue
        new Color(0.55f, 0.65f, 0.55f), // Sage Green
        new Color(0.80f, 0.45f, 0.35f)  // Terracotta
    };

    private ARPlane currentPlane;

    void Awake()
    {
        if (presetColors == null || presetColors.Length == 0)
        {
            presetColors = new Color[]
            {
                Color.white,
                new Color(0.96f, 0.95f, 0.90f), // Beige
                new Color(0.85f, 0.85f, 0.85f), // Light Gray
                new Color(0.68f, 0.85f, 0.90f), // Sky Blue
                new Color(0.55f, 0.65f, 0.55f), // Sage Green
                new Color(0.80f, 0.45f, 0.35f)  // Terracotta
            };
        }

        // Fallbacks if not set in Editor inspector
        if (wallSelector == null) wallSelector = FindFirstObjectByType<WallSelector>();
        if (wallPainter == null) wallPainter = FindFirstObjectByType<WallPainter>();
        
        // Hide panel at start
        if (uiPanel != null) uiPanel.SetActive(false);
    }

    void OnEnable()
    {
        // Re-acquire references in case they were null at Awake (e.g. inactive objects)
        if (wallSelector == null) wallSelector = FindFirstObjectByType<WallSelector>();
        if (wallPainter == null) wallPainter = FindFirstObjectByType<WallPainter>();

        if (wallSelector != null)
        {
            wallSelector.OnWallSelectedEvent.AddListener(OnWallSelected);
            Debug.Log("[ColorPicker] ✅ Subscribed to WallSelector.OnWallSelectedEvent");
        }
        else
        {
            Debug.LogError("[ColorPicker] CRITICAL: wallSelector is NULL in OnEnable — color picker will never receive wall selection events!");
        }

        // Attach listeners to color swatch buttons (only if Canvas UI buttons are assigned)
        // If presetButtons is null or empty, the OnGUI fallback handles input instead.
        if (presetButtons != null)
        {
            for (int i = 0; i < presetButtons.Length && i < presetColors.Length; i++)
            {
                int index = i; // Prevent closure capture issues
                if (presetButtons[i] != null)
                {
                    presetButtons[i].onClick.AddListener(() => OnPresetButtonClicked(presetColors[index]));
                }
            }
        }

        if (resetButton != null) resetButton.onClick.AddListener(OnResetButtonClicked);
        if (closeButton != null) closeButton.onClick.AddListener(OnCloseButtonClicked);
    }

    void OnDisable()
    {
        if (wallSelector != null)
        {
            wallSelector.OnWallSelectedEvent.RemoveListener(OnWallSelected);
        }

        // Clean up UI event listeners
        foreach (var btn in presetButtons)
        {
            if (btn != null) btn.onClick.RemoveAllListeners();
        }

        if (resetButton != null) resetButton.onClick.RemoveAllListeners();
        if (closeButton != null) closeButton.onClick.RemoveAllListeners();

        // Hide UI and deselect when disabled
        currentPlane = null;
        if (uiPanel != null)
        {
            uiPanel.SetActive(false);
        }
    }

    private void OnWallSelected(ARPlane plane)
    {
        currentPlane = plane;
        Debug.Log($"[ColorPicker] ✅ OnWallSelected received plane: {plane.trackableId}. Showing UI.");
        if (uiPanel != null)
        {
            uiPanel.SetActive(true);
        }
    }

    private void OnPresetButtonClicked(Color color)
    {
        Debug.Log($"[ColorPicker] Swatch clicked. currentPlane={(currentPlane != null ? currentPlane.trackableId.ToString() : "NULL")}, wallPainter={(wallPainter != null ? "OK" : "NULL")}");
        if (currentPlane == null)
        {
            Debug.LogWarning("[ColorPicker] Cannot paint — no wall is currently selected. Tap a wall first.");
            return;
        }
        if (wallPainter == null)
        {
            Debug.LogError("[ColorPicker] CRITICAL: wallPainter is NULL — cannot paint wall!");
            return;
        }
        wallPainter.PaintWall(currentPlane, color);
    }

    private void OnResetButtonClicked()
    {
        if (currentPlane != null && wallPainter != null)
        {
            wallPainter.ResetWall(currentPlane);
        }
    }

    private void OnCloseButtonClicked()
    {
        currentPlane = null;
        if (uiPanel != null)
        {
            uiPanel.SetActive(false);
        }
    }

    private void OnGUI()
    {
        // Immediate-mode GUI fallback if UI reference is not set up in Inspector
        if (uiPanel == null && currentPlane != null)
        {
            // Determine dynamic sizes based on screen width
            float panelWidth = Screen.width * 0.92f;
            float panelHeight = Mathf.Clamp(Screen.width * 0.38f, 260f, 480f);
            int fontSize = Mathf.Max(14, Mathf.RoundToInt(panelWidth * 0.042f));
            int titleFontSize = Mathf.Max(16, Mathf.RoundToInt(panelWidth * 0.045f));

            GUI.skin.label.fontSize = titleFontSize;
            GUI.skin.button.fontSize = fontSize;
            GUI.skin.box.fontSize = fontSize;

            // Position at bottom center, slightly above the navigation bar/furniture UI
            float posX = (Screen.width - panelWidth) * 0.5f;
            float posY = Screen.height - panelHeight - 40f;

            GUILayout.BeginArea(new Rect(posX, posY, panelWidth, panelHeight));
            GUILayout.BeginVertical("box");
            
            GUILayout.Label($"<b>Wall Selected:</b> {currentPlane.trackableId}", GUILayout.ExpandWidth(true));
            
            GUILayout.Space(12);
            
            // Preset color buttons
            GUILayout.BeginHorizontal();
            string[] names = new string[] { "White", "Beige", "Gray", "Blue", "Green", "Terracotta" };
            float swatchHeight = panelHeight * 0.28f;
            for (int i = 0; i < presetColors.Length; i++)
            {
                if (GUILayout.Button(names[i], GUILayout.Height(swatchHeight), GUILayout.ExpandWidth(true)))
                {
                    OnPresetButtonClicked(presetColors[i]);
                }
            }
            GUILayout.EndHorizontal();
            
            GUILayout.Space(15);
            
            // Action buttons
            GUILayout.BeginHorizontal();
            float actionHeight = panelHeight * 0.28f;
            if (GUILayout.Button("Reset Wall Paint", GUILayout.Height(actionHeight), GUILayout.ExpandWidth(true)))
            {
                OnResetButtonClicked();
            }
            if (GUILayout.Button("Deselect Wall", GUILayout.Height(actionHeight), GUILayout.ExpandWidth(true)))
            {
                OnCloseButtonClicked();
            }
            GUILayout.EndHorizontal();
            
            GUILayout.EndVertical();
            GUILayout.EndArea();
        }
    }
}
