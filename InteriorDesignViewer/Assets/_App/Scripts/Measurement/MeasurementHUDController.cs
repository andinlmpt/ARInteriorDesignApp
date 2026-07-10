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
    [SerializeField] private TMP_Text totalDistanceText;
    [SerializeField] private TMP_Text liveDistanceText;
    [SerializeField] private Toggle modeToggle;

    [Header("UI — Height tool")]
    [SerializeField] private TMP_Text heightInstructionText;  // text child inside banner
    [SerializeField] private GameObject heightBannerRoot;      // parent container (Image bg + text); toggled to show/hide
    [SerializeField] private Button finishHeightButton;        // visible only while Extruding

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

        if (modeToggle != null)
            modeToggle.onValueChanged.AddListener(HandleModeToggle);

        if (toolToggle != null)
            toolToggle.onValueChanged.AddListener(HandleToolToggle);

        if (clearButton != null)
            clearButton.onClick.AddListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.AddListener(OnUndoPressed);

        if (finishHeightButton != null)
            finishHeightButton.onClick.AddListener(OnFinishHeightPressed);

        RefreshTotalLabel(0f);
        RefreshLiveLabel(0f, false);
        UpdateModeToggleLabel();
        SetControlsVisible(scanController == null || scanController.IsScanComplete);
        RefreshToolUI(MeasurementController.MeasurementTool.Distance);
        SetFinishButtonVisible(false);
        SetHeightBannerVisible(false);
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

        if (modeToggle != null)
            modeToggle.onValueChanged.RemoveListener(HandleModeToggle);

        if (toolToggle != null)
            toolToggle.onValueChanged.RemoveListener(HandleToolToggle);

        if (clearButton != null)
            clearButton.onClick.RemoveListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.RemoveListener(OnUndoPressed);

        if (finishHeightButton != null)
            finishHeightButton.onClick.RemoveListener(OnFinishHeightPressed);
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

        RefreshLiveLabel(liveMeters, measurementController.IsLivePreviewActive);
    }

    void HandlePointCountChanged(int pointCount)
    {
        if (undoButton != null && measurementController != null &&
            measurementController.ActiveTool == MeasurementController.MeasurementTool.Distance)
        {
            undoButton.interactable = pointCount > 0;
        }
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
        SetFinishButtonVisible(extruding);
        SetHeightBannerVisible(extruding);

        if (undoButton != null)
            undoButton.interactable = true; // always allow undo in height mode
    }

    // ── Button / toggle handlers ──────────────────────────────────────────────

    void HandleModeToggle(bool isChained)
    {
        if (measurementController == null) return;

        measurementController.SetMode(isChained
            ? MeasurementController.MeasurementMode.Chained
            : MeasurementController.MeasurementMode.Single);

        UpdateModeToggleLabel();
    }

    void HandleToolToggle(bool isHeight)
    {
        if (measurementController == null) return;

        measurementController.SetTool(isHeight
            ? MeasurementController.MeasurementTool.Height
            : MeasurementController.MeasurementTool.Distance);
    }

    void OnClearPressed()
    {
        measurementController?.ClearAll();
        SetFinishButtonVisible(false);
        SetHeightBannerVisible(false);
    }

    void OnUndoPressed()
    {
        measurementController?.UndoLastPoint();
    }

    void OnFinishHeightPressed()
    {
        measurementController?.FinishHeightMeasurement();
        SetFinishButtonVisible(false);
        SetHeightBannerVisible(false);
    }

    // ── UI visibility helpers ─────────────────────────────────────────────────

    void RefreshToolUI(MeasurementController.MeasurementTool tool)
    {
        bool isDistance = tool == MeasurementController.MeasurementTool.Distance;

        if (totalDistanceText != null)
            totalDistanceText.gameObject.SetActive(isDistance);

        if (liveDistanceText != null)
            liveDistanceText.gameObject.SetActive(isDistance);

        if (modeToggle != null)
            modeToggle.gameObject.SetActive(isDistance);

        // Hide height UI when in distance mode
        if (!isDistance) return;

        SetFinishButtonVisible(false);
        SetHeightBannerVisible(false);
    }

    void SetFinishButtonVisible(bool visible)
    {
        if (finishHeightButton != null)
            finishHeightButton.gameObject.SetActive(visible);
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
        if (totalDistanceText != null) totalDistanceText.gameObject.SetActive(visible);
        if (liveDistanceText != null) liveDistanceText.gameObject.SetActive(visible);
    }

    void RefreshTotalLabel(float totalMeters)
    {
        if (totalDistanceText == null) return;

        totalDistanceText.text = totalMeters > 0f
            ? $"Total: {MeasurementController.FormatMeters(totalMeters)}"
            : "Total: —";
    }

    void RefreshLiveLabel(float liveMeters, bool active)
    {
        if (liveDistanceText == null) return;

        liveDistanceText.text = active
            ? MeasurementController.FormatLive(liveMeters)
            : string.Empty;
    }

    void UpdateModeToggleLabel()
    {
        if (modeToggle == null) return;

        var label = modeToggle.GetComponentInChildren<TMP_Text>();
        if (label == null) return;

        label.text = modeToggle.isOn ? chainedModeLabel : singleModeLabel;
    }
}
