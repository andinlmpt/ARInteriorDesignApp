using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Screen-space HUD for the ARRoomMeasurement scene.
/// Supports Distance and Height tool modes.
/// </summary>
public class MeasurementHUDController : MonoBehaviour
{
    [Header("Scan")]
    [SerializeField] private MeasurementScanController scanController;
    [SerializeField] private MeasurementScanOverlay scanOverlay;

    [Header("Measurement")]
    [SerializeField] private MeasurementController measurementController;

    [Header("UI — common")]
    [SerializeField] private GameObject measurementControlsRoot;
    [SerializeField] private TMP_Text scanHintText;
    [SerializeField] private TMP_Text statusText;
    [SerializeField] private Button clearButton;
    [SerializeField] private Button undoButton;

    [Header("UI — Distance tool")]
    [SerializeField] private TMP_Text liveDistanceText;

    [Header("UI — Mode & Tool Dropdown")]
    [SerializeField] private TMP_Dropdown modeDropdown;      // Options: 0=Horizontal Single, 1=Horizontal Chained, 2=Vertical Height

    [Header("UI — Height tool")]
    [SerializeField] private TMP_Text heightInstructionText;  // text child inside banner
    [SerializeField] private GameObject heightBannerRoot;      // parent container (Image bg + text); toggled to show/hide

    [Header("UI — Action Buttons")]
    [SerializeField] private Button startButton;              // Start/Add Point button
    [SerializeField] private Button finishButton;             // Finish button

    [Header("UI — Tool toggle")]
    [SerializeField] private Toggle toolToggle;                // off=Distance, on=Height

    [Header("Copy")]
    [SerializeField] private string chainedModeLabel = "Chained / Perimeter";
    [SerializeField] private string singleModeLabel = "Single measurement";

    void Awake()
    {
        if (measurementController == null)
            measurementController = FindFirstObjectByType<MeasurementController>();

        if (scanController == null)
            scanController = FindFirstObjectByType<MeasurementScanController>();

        if (scanOverlay == null)
            scanOverlay = FindFirstObjectByType<MeasurementScanOverlay>();

        if (scanOverlay != null && measurementControlsRoot != null)
            scanOverlay.SetMeasurementControlsRoot(measurementControlsRoot);
    }

    void OnEnable()
    {
        if (scanController != null)
        {
            scanController.OnHintChanged += HandleScanHint;
            scanController.OnPhaseChanged += HandleScanPhaseChanged;
        }

        if (measurementController != null)
        {
            measurementController.OnTotalDistanceChanged += HandleTotalDistanceChanged;
            measurementController.OnLiveDistanceChanged += HandleLiveDistanceChanged;
            measurementController.OnStatusChanged += HandleMeasurementStatus;
            measurementController.OnPointCountChanged += HandlePointCountChanged;
            measurementController.OnLiveHeightChanged += HandleLiveHeightChanged;
            measurementController.OnToolChanged += HandleToolChanged;
            measurementController.OnHeightPhaseChanged += HandleHeightPhaseChanged;
        }

        if (modeDropdown != null)
        {
            modeDropdown.ClearOptions();
            modeDropdown.AddOptions(new System.Collections.Generic.List<string> { "Single Measurement", "Chained / Perimeter", "Height Measurement" });
            modeDropdown.onValueChanged.AddListener(HandleDropdownChanged);
            
            // Set initial state
            int initialVal = 0;
            if (measurementController != null)
            {
                if (measurementController.ActiveTool == MeasurementController.MeasurementTool.Height)
                    initialVal = 2;
                else
                    initialVal = measurementController.Mode == MeasurementController.MeasurementMode.Chained ? 1 : 0;
            }
            modeDropdown.value = initialVal;
        }

        if (clearButton != null)
            clearButton.onClick.AddListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.AddListener(OnUndoPressed);

        if (startButton != null)
            startButton.onClick.AddListener(OnStartPressed);

        if (finishButton != null)
            finishButton.onClick.AddListener(OnFinishPressed);

        RefreshTotalLabel(0f);
        if (liveDistanceText != null) liveDistanceText.text = string.Empty;
        SetControlsVisible(scanController == null || scanController.IsScanComplete);
        RefreshToolUI(MeasurementController.MeasurementTool.Distance);
        SetHeightBannerVisible(false);
        RefreshActionButtons();
    }

    void OnDisable()
    {
        if (scanController != null)
        {
            scanController.OnHintChanged -= HandleScanHint;
            scanController.OnPhaseChanged -= HandleScanPhaseChanged;
        }

        if (measurementController != null)
        {
            measurementController.OnTotalDistanceChanged -= HandleTotalDistanceChanged;
            measurementController.OnLiveDistanceChanged -= HandleLiveDistanceChanged;
            measurementController.OnStatusChanged -= HandleMeasurementStatus;
            measurementController.OnPointCountChanged -= HandlePointCountChanged;
            measurementController.OnLiveHeightChanged -= HandleLiveHeightChanged;
            measurementController.OnToolChanged -= HandleToolChanged;
            measurementController.OnHeightPhaseChanged -= HandleHeightPhaseChanged;
        }

        if (modeDropdown != null)
            modeDropdown.onValueChanged.RemoveListener(HandleDropdownChanged);

        if (clearButton != null)
            clearButton.onClick.RemoveListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.RemoveListener(OnUndoPressed);

        if (startButton != null)
            startButton.onClick.RemoveListener(OnStartPressed);

        if (finishButton != null)
            finishButton.onClick.RemoveListener(OnFinishPressed);
    }

    // ── Scan events ───────────────────────────────────────────────────────────

    void HandleScanHint(string hint)
    {
        if (scanHintText != null)
            scanHintText.text = hint;
    }

    void HandleScanPhaseChanged(MeasurementScanController.ScanPhase phase)
    {
        SetControlsVisible(phase == MeasurementScanController.ScanPhase.Ready);
        RefreshActionButtons();
    }

    // ── Measurement events ────────────────────────────────────────────────────

    void HandleMeasurementStatus(string status)
    {
        if (statusText != null)
            statusText.text = status;
    }

    void HandleTotalDistanceChanged(float totalMeters)
    {
        RefreshTotalLabel(totalMeters);
    }

    void HandleLiveDistanceChanged(float liveMeters)
    {
        if (measurementController == null || measurementController.ActiveTool != MeasurementController.MeasurementTool.Distance)
            return;

        if (liveDistanceText != null)
        {
            liveDistanceText.text = measurementController.IsLivePreviewActive
                ? MeasurementController.FormatLive(liveMeters)
                : string.Empty;
        }
    }

    void HandlePointCountChanged(int pointCount)
    {
        if (undoButton != null && measurementController != null &&
            measurementController.ActiveTool == MeasurementController.MeasurementTool.Distance)
        {
            undoButton.interactable = pointCount > 0;
        }
        RefreshActionButtons();
    }

    void HandleLiveHeightChanged(float heightMeters)
    {
        // World-space label handles display; screen-space live text is optional here
    }

    void HandleToolChanged(MeasurementController.MeasurementTool tool)
    {
        RefreshToolUI(tool);
    }

    void HandleHeightPhaseChanged(MeasurementController.HeightPhase phase)
    {
        bool extruding = phase == MeasurementController.HeightPhase.Extruding;
        SetHeightBannerVisible(extruding);
        RefreshActionButtons();

        if (undoButton != null)
            undoButton.interactable = true; // always allow undo in height mode
    }

    // ── Button / toggle handlers ──────────────────────────────────────────────

    void HandleDropdownChanged(int index)
    {
        if (measurementController == null) return;

        // Reset measurement states when switching modes
        measurementController.ClearAll();

        if (index == 0)
        {
            measurementController.SetTool(MeasurementController.MeasurementTool.Distance);
            measurementController.SetMode(MeasurementController.MeasurementMode.Single);
        }
        else if (index == 1)
        {
            measurementController.SetTool(MeasurementController.MeasurementTool.Distance);
            measurementController.SetMode(MeasurementController.MeasurementMode.Chained);
        }
        else if (index == 2)
        {
            measurementController.SetTool(MeasurementController.MeasurementTool.Height);
        }

        RefreshActionButtons();
    }

    void OnClearPressed()
    {
        measurementController?.ClearAll();
        SetHeightBannerVisible(false);
        RefreshActionButtons();
    }

    void OnUndoPressed()
    {
        measurementController?.UndoLastPoint();
        RefreshActionButtons();
    }

    void OnStartPressed()
    {
        measurementController?.TriggerStart();
        RefreshActionButtons();
    }

    void OnFinishPressed()
    {
        measurementController?.TriggerFinish();
        RefreshActionButtons();
    }

    // ── UI visibility helpers ─────────────────────────────────────────────────

    void RefreshToolUI(MeasurementController.MeasurementTool tool)
    {
        bool isDistance = tool == MeasurementController.MeasurementTool.Distance;

        if (liveDistanceText != null)
            liveDistanceText.gameObject.SetActive(isDistance);

        if (modeDropdown != null)
            modeDropdown.gameObject.SetActive(true); // always show dropdown

        // Hide height UI when in distance mode
        if (!isDistance) return;

        SetHeightBannerVisible(false);
        RefreshActionButtons();
    }

    void SetHeightBannerVisible(bool visible)
    {
        // Toggle the container (Image bg + text child). Fall back to text GO if no root is set.
        if (heightBannerRoot != null)
            heightBannerRoot.SetActive(visible);
        else if (heightInstructionText != null)
            heightInstructionText.gameObject.SetActive(visible);
    }

    void SetControlsVisible(bool visible)
    {
        if (measurementControlsRoot != null)
            measurementControlsRoot.SetActive(visible);

        if (scanHintText != null) scanHintText.gameObject.SetActive(visible);
        if (statusText != null) statusText.gameObject.SetActive(visible);
        if (liveDistanceText != null) liveDistanceText.gameObject.SetActive(visible);
    }

    void RefreshTotalLabel(float totalMeters)
    {
        // Removed total label support
    }


    // ── Dynamic button management ─────────────────────────────────────────────

    void RefreshActionButtons()
    {
        if (measurementController == null) return;

        // Hide action buttons during initial scanning
        if (scanController != null && !scanController.IsScanComplete)
        {
            if (startButton != null) startButton.gameObject.SetActive(false);
            if (finishButton != null) finishButton.gameObject.SetActive(false);
            return;
        }

        bool isDistance = measurementController.ActiveTool == MeasurementController.MeasurementTool.Distance;

        if (isDistance)
        {
            int pointCount = measurementController.PointCount;
            bool isSingle = measurementController.Mode == MeasurementController.MeasurementMode.Single;
            bool awaitingNewPair = measurementController.IsAwaitingNewPair;

            if (pointCount == 0 || (isSingle && awaitingNewPair))
            {
                SetButtonState(startButton, true, "Start");
                SetButtonState(finishButton, false);
            }
            else
            {
                if (isSingle)
                {
                    SetButtonState(startButton, false);
                    SetButtonState(finishButton, true, "Finish");
                }
                else // Chained
                {
                    SetButtonState(startButton, true, "Add Point");
                    SetButtonState(finishButton, true, "Finish");
                }
            }
        }
        else // Height tool
        {
            var phase = measurementController.CurrentHeightPhase;

            if (phase == MeasurementController.HeightPhase.AwaitingBase)
            {
                SetButtonState(startButton, true, "Start");
                SetButtonState(finishButton, false);
            }
            else if (phase == MeasurementController.HeightPhase.Extruding)
            {
                SetButtonState(startButton, false);
                SetButtonState(finishButton, true, "Finish");
            }
            else
            {
                SetButtonState(startButton, false);
                SetButtonState(finishButton, false);
            }
        }

        // Adjust horizontal layout dynamically:
        // - If both buttons are active (e.g. in Chained Mode), place them side-by-side with offset.
        // - If only one button is active, center it perfectly at X = 0.
        if (startButton != null && finishButton != null)
        {
            var startActive = startButton.gameObject.activeSelf;
            var finishActive = finishButton.gameObject.activeSelf;
            var startRect = startButton.GetComponent<RectTransform>();
            var finishRect = finishButton.GetComponent<RectTransform>();

            if (startActive && finishActive)
            {
                if (startRect != null) startRect.anchoredPosition = new Vector2(-130f, startRect.anchoredPosition.y);
                if (finishRect != null) finishRect.anchoredPosition = new Vector2(130f, finishRect.anchoredPosition.y);
            }
            else
            {
                if (startRect != null) startRect.anchoredPosition = new Vector2(0f, startRect.anchoredPosition.y);
                if (finishRect != null) finishRect.anchoredPosition = new Vector2(0f, finishRect.anchoredPosition.y);
            }
        }
    }

    void SetButtonState(Button button, bool visible, string labelText = null)
    {
        if (button == null) return;
        button.gameObject.SetActive(visible);
        if (visible && labelText != null)
        {
            var label = button.GetComponentInChildren<TMP_Text>();
            if (label != null) label.text = labelText;
        }
    }
}

