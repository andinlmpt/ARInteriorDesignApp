using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Screen-space HUD for the ARRoomMeasurement scene.
/// </summary>
public class MeasurementHUDController : MonoBehaviour
{
    [Header("Scan")]
    [SerializeField] private MeasurementScanController scanController;
    [SerializeField] private MeasurementScanOverlay scanOverlay;

    [Header("Measurement")]
    [SerializeField] private MeasurementController measurementController;

    [Header("UI")]
    [SerializeField] private GameObject measurementControlsRoot;
    [SerializeField] private TMP_Text scanHintText;
    [SerializeField] private TMP_Text statusText;
    [SerializeField] private TMP_Text totalDistanceText;
    [SerializeField] private TMP_Text liveDistanceText;
    [SerializeField] private Toggle modeToggle;
    [SerializeField] private Button clearButton;
    [SerializeField] private Button undoButton;

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
        }

        if (modeToggle != null)
            modeToggle.onValueChanged.AddListener(HandleModeToggle);

        if (clearButton != null)
            clearButton.onClick.AddListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.AddListener(OnUndoPressed);

        RefreshTotalLabel(0f);
        RefreshLiveLabel(0f, false);
        UpdateModeToggleLabel();
        SetControlsVisible(scanController == null || scanController.IsScanComplete);
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
        }

        if (modeToggle != null)
            modeToggle.onValueChanged.RemoveListener(HandleModeToggle);

        if (clearButton != null)
            clearButton.onClick.RemoveListener(OnClearPressed);

        if (undoButton != null)
            undoButton.onClick.RemoveListener(OnUndoPressed);
    }

    void HandleScanHint(string hint)
    {
        if (scanHintText != null)
            scanHintText.text = hint;
    }

    void HandleScanPhaseChanged(MeasurementScanController.ScanPhase phase)
    {
        SetControlsVisible(phase == MeasurementScanController.ScanPhase.Ready);
    }

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
        RefreshLiveLabel(liveMeters, measurementController != null && measurementController.IsLivePreviewActive);
    }

    void HandlePointCountChanged(int pointCount)
    {
        if (undoButton != null)
            undoButton.interactable = pointCount > 0;
    }

    void HandleModeToggle(bool isChained)
    {
        if (measurementController == null)
            return;

        measurementController.SetMode(isChained
            ? MeasurementController.MeasurementMode.Chained
            : MeasurementController.MeasurementMode.Single);

        UpdateModeToggleLabel();
    }

    void OnClearPressed()
    {
        measurementController?.ClearAll();
    }

    void OnUndoPressed()
    {
        measurementController?.UndoLastPoint();
    }

    void SetControlsVisible(bool visible)
    {
        if (measurementControlsRoot != null)
            measurementControlsRoot.SetActive(visible);

        if (scanHintText != null)
            scanHintText.gameObject.SetActive(visible);
        if (statusText != null)
            statusText.gameObject.SetActive(visible);
        if (totalDistanceText != null)
            totalDistanceText.gameObject.SetActive(visible);
        if (liveDistanceText != null)
            liveDistanceText.gameObject.SetActive(visible);
    }

    void RefreshTotalLabel(float totalMeters)
    {
        if (totalDistanceText == null)
            return;

        totalDistanceText.text = totalMeters > 0f
            ? $"Total: {MeasurementController.FormatMeters(totalMeters)}"
            : "Total: —";
    }

    void RefreshLiveLabel(float liveMeters, bool active)
    {
        if (liveDistanceText == null)
            return;

        liveDistanceText.text = active
            ? MeasurementController.FormatLive(liveMeters)
            : string.Empty;
    }

    void UpdateModeToggleLabel()
    {
        if (modeToggle == null)
            return;

        var label = modeToggle.GetComponentInChildren<TMP_Text>();
        if (label == null)
            return;

        label.text = modeToggle.isOn ? chainedModeLabel : singleModeLabel;
    }
}
