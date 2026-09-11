using System;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// After room scan confirm, shows a modal with dimensions and a Save Measurement button
/// that posts to MongoDB via <see cref="RoomMeasurementSync"/>.
/// </summary>
[DefaultExecutionOrder(-80)]
public class RoomMeasurementSaveModal : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private RoomMeasurementSync measurementSync;
    [SerializeField] private bool enableNativeModal = true;

    static readonly Color Ink = new(0.10f, 0.10f, 0.12f, 1f);
    static readonly Color InkMuted = new(0.40f, 0.42f, 0.46f, 1f);
    static readonly Color Frost = new(1f, 1f, 1f, 0.97f);
    static readonly Color Accent = new(0.15f, 0.39f, 0.92f, 1f);
    static readonly Color AccentOk = new(0.18f, 0.55f, 0.42f, 1f);
    static readonly Color Dim = new(0f, 0f, 0f, 0.45f);

    Canvas canvas;
    Text titleLabel;
    Text dimensionLabel;
    Text detailLabel;
    Text statusLabel;
    Button saveButton;
    Button continueButton;
    Image saveButtonBg;
    Text saveButtonText;
    bool active;
    bool saving;
    RoomConfirmedPayload pendingPayload;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (measurementSync == null) measurementSync = FindFirstObjectByType<RoomMeasurementSync>();

        active = enableNativeModal && !ARDesignHostDetect.IsEmbeddedInReactNative();
        if (!active)
        {
            enabled = false;
            return;
        }

        BuildUi();
        SetVisible(false);
    }

    void OnEnable()
    {
        if (!active || scanController == null) return;
        scanController.PhaseChanged += OnPhaseChanged;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhaseChanged;
    }

    void OnPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (phase != RoomScanController.ScanPhase.Confirmed)
        {
            SetVisible(false);
            return;
        }

        pendingPayload = RoomMeasurementPayloadBuilder.Build(scanController);
        if (pendingPayload == null || pendingPayload.width <= 0f)
        {
            Debug.LogWarning("[RoomMeasurementSaveModal] Room confirmed but dimensions are missing.");
            return;
        }

        saving = false;
        RefreshLabels();
        SetVisible(true);
    }

    void RefreshLabels()
    {
        if (pendingPayload == null) return;

        if (dimensionLabel != null)
        {
            dimensionLabel.text = string.IsNullOrWhiteSpace(pendingPayload.dimensionLabel)
                ? $"L {pendingPayload.depth:F1}m × W {pendingPayload.width:F1}m × H {pendingPayload.height:F1}m"
                : pendingPayload.dimensionLabel.Trim();
        }

        if (detailLabel != null)
        {
            var area = pendingPayload.floorAreaSqm > 0f
                ? $"{pendingPayload.floorAreaSqm:F1} m² floor"
                : "Floor area pending";
            detailLabel.text = area;
        }

        if (statusLabel != null)
            statusLabel.text = string.Empty;

        if (saveButton != null) saveButton.interactable = !saving;
        if (continueButton != null) continueButton.interactable = !saving;
        if (saveButtonBg != null) saveButtonBg.color = saving ? new Color(0.7f, 0.7f, 0.72f, 1f) : Accent;
        if (saveButtonText != null) saveButtonText.text = saving ? "Saving…" : "Save measurement";
    }

    void OnSaveClicked()
    {
        if (pendingPayload == null || measurementSync == null || saving) return;

        saving = true;
        RefreshLabels();

        measurementSync.SaveMeasurement(pendingPayload);
        StartCoroutine(WaitForSaveResult());
    }

    System.Collections.IEnumerator WaitForSaveResult()
    {
        const float timeout = 18f;
        var elapsed = 0f;
        while (elapsed < timeout && !measurementSync.LastSaveSucceeded && string.IsNullOrEmpty(measurementSync.LastError))
        {
            elapsed += Time.unscaledDeltaTime;
            yield return null;
        }

        saving = false;

        if (measurementSync.LastSaveSucceeded)
        {
            if (statusLabel != null)
                statusLabel.text = "Saved to your account.";
            if (saveButtonBg != null) saveButtonBg.color = AccentOk;
            if (saveButtonText != null) saveButtonText.text = "Saved";
            if (continueButton != null) continueButton.interactable = true;
        if (saveButton != null) saveButton.interactable = false;
        }
        else
        {
            if (statusLabel != null)
            {
                statusLabel.text = string.IsNullOrWhiteSpace(measurementSync.LastError)
                    ? "Could not save. Check Wi‑Fi and backend."
                    : measurementSync.LastError;
            }
            if (continueButton != null) continueButton.interactable = true;
            RefreshLabels();
        }
    }

    void OnContinueClicked()
    {
        SetVisible(false);
    }

    void SetVisible(bool visible)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(visible);
    }

    void BuildUi()
    {
        ARDesignUiUtil.EnsureEventSystem();

        var root = new GameObject("RoomMeasurementSaveModal");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 1100;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        var backdrop = ARDesignUiUtil.CreateImage(root.transform, Dim);
        var backdropRt = backdrop.rectTransform;
        backdropRt.anchorMin = Vector2.zero;
        backdropRt.anchorMax = Vector2.one;
        backdropRt.offsetMin = Vector2.zero;
        backdropRt.offsetMax = Vector2.zero;

        var card = ARDesignUiUtil.CreateRoundedImage(root.transform, Frost, 28);
        var cardRt = card.rectTransform;
        cardRt.anchorMin = new Vector2(0.5f, 0.5f);
        cardRt.anchorMax = new Vector2(0.5f, 0.5f);
        cardRt.pivot = new Vector2(0.5f, 0.5f);
        cardRt.sizeDelta = new Vector2(520f, 360f);

        titleLabel = ARDesignUiUtil.CreateText(card.transform, "Room measured", 26, FontStyle.Bold, TextAnchor.MiddleCenter);
        titleLabel.color = Ink;
        var titleRt = titleLabel.rectTransform;
        titleRt.anchorMin = new Vector2(0.08f, 0.78f);
        titleRt.anchorMax = new Vector2(0.92f, 0.94f);
        titleRt.offsetMin = Vector2.zero;
        titleRt.offsetMax = Vector2.zero;

        dimensionLabel = ARDesignUiUtil.CreateText(card.transform, "—", 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        dimensionLabel.color = Ink;
        var dimRt = dimensionLabel.rectTransform;
        dimRt.anchorMin = new Vector2(0.08f, 0.58f);
        dimRt.anchorMax = new Vector2(0.92f, 0.76f);
        dimRt.offsetMin = Vector2.zero;
        dimRt.offsetMax = Vector2.zero;

        detailLabel = ARDesignUiUtil.CreateText(card.transform, "", 16, FontStyle.Normal, TextAnchor.MiddleCenter);
        detailLabel.color = InkMuted;
        var detailRt = detailLabel.rectTransform;
        detailRt.anchorMin = new Vector2(0.08f, 0.48f);
        detailRt.anchorMax = new Vector2(0.92f, 0.58f);
        detailRt.offsetMin = Vector2.zero;
        detailRt.offsetMax = Vector2.zero;

        statusLabel = ARDesignUiUtil.CreateText(card.transform, "", 14, FontStyle.Normal, TextAnchor.MiddleCenter);
        statusLabel.color = AccentOk;
        var statusRt = statusLabel.rectTransform;
        statusRt.anchorMin = new Vector2(0.08f, 0.38f);
        statusRt.anchorMax = new Vector2(0.92f, 0.48f);
        statusRt.offsetMin = Vector2.zero;
        statusRt.offsetMax = Vector2.zero;

        saveButton = CreateModalButton(
            card.transform,
            "Save measurement",
            new Vector2(0.08f, 0.12f),
            new Vector2(0.92f, 0.34f),
            Accent,
            Color.white,
            OnSaveClicked,
            out saveButtonBg,
            out saveButtonText);

        continueButton = CreateModalButton(
            card.transform,
            "Continue to furniture",
            new Vector2(0.08f, 0.02f),
            new Vector2(0.92f, 0.11f),
            new Color(0.93f, 0.94f, 0.96f, 1f),
            Ink,
            OnContinueClicked,
            out _,
            out _);
    }

    static Button CreateModalButton(
        Transform parent,
        string label,
        Vector2 anchorMin,
        Vector2 anchorMax,
        Color bg,
        Color textColor,
        Action onClick,
        out Image image,
        out Text text)
    {
        var go = new GameObject(label + "Button", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(image, 20);
        image.color = bg;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(() => onClick?.Invoke());

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        text = ARDesignUiUtil.CreateText(go.transform, label, 18, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = textColor;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = Vector2.zero;
        textRt.offsetMax = Vector2.zero;
        return button;
    }
}
