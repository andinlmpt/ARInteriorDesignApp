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
    [SerializeField] private bool measurementOnlyMode = false;
    [SerializeField] private bool enableNativeModal = true;

    public static event Action RoomNameCommitted;

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
    Button cancelButton;
    InputField roomNameInput;
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

        BuildUi(measurementOnlyMode);
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
        if (saveButtonText != null)
        {
            saveButtonText.text = saving
                ? "Saving…"
                : (measurementOnlyMode ? "Save measure" : "Save measurement");
        }
    }

    void OnSaveClicked()
    {
        if (pendingPayload == null || saving) return;

        if (measurementOnlyMode)
        {
            var name = roomNameInput != null ? roomNameInput.text : string.Empty;
            ARMeasurementSession.SetRoomName(name);
            SetVisible(false);
            RoomNameCommitted?.Invoke();
            return;
        }

        if (measurementSync == null) return;

        saving = true;
        RefreshLabels();

        measurementSync.SaveMeasurement(pendingPayload);
        StartCoroutine(WaitForSaveResult());
    }

    void OnCancelClicked()
    {
        if (!measurementOnlyMode) return;
        ARMeasurementSession.SetRoomName("Untitled room");
        SetVisible(false);
        RoomNameCommitted?.Invoke();
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

        // Avoid stacking the floating MainMenu back over this modal.
        if (measurementOnlyMode)
            ARMainMenuBackButton.SetUiVisible(!visible);
    }

    void BuildUi(bool measurementMode)
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
        cardRt.sizeDelta = measurementMode ? new Vector2(680f, 340f) : new Vector2(520f, 360f);

        if (measurementMode)
        {
            titleLabel = ARDesignUiUtil.CreateText(card.transform, "Enter room's name", 28, FontStyle.Bold, TextAnchor.MiddleCenter);
            titleLabel.color = Ink;
            var titleRt = titleLabel.rectTransform;
            titleRt.anchorMin = new Vector2(0.08f, 0.72f);
            titleRt.anchorMax = new Vector2(0.92f, 0.92f);
            titleRt.offsetMin = Vector2.zero;
            titleRt.offsetMax = Vector2.zero;

            roomNameInput = CreateRoomNameField(card.transform);

            // Action row: Cancel + Save measure on one line with comfortable spacing
            cancelButton = CreateTextButton(
                card.transform,
                "Cancel",
                new Vector2(0.08f, 0.10f),
                new Vector2(0.36f, 0.30f),
                OnCancelClicked);
            saveButton = CreateModalButton(
                card.transform,
                "Save measure",
                new Vector2(0.40f, 0.10f),
                new Vector2(0.92f, 0.30f),
                Accent,
                Color.white,
                OnSaveClicked,
                out saveButtonBg,
                out saveButtonText);
            return;
        }

        titleLabel = ARDesignUiUtil.CreateText(card.transform, "Room measured", 26, FontStyle.Bold, TextAnchor.MiddleCenter);
        titleLabel.color = Ink;
        var measuredTitleRt = titleLabel.rectTransform;
        measuredTitleRt.anchorMin = new Vector2(0.08f, 0.78f);
        measuredTitleRt.anchorMax = new Vector2(0.92f, 0.94f);
        measuredTitleRt.offsetMin = Vector2.zero;
        measuredTitleRt.offsetMax = Vector2.zero;

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

    static InputField CreateRoomNameField(Transform parent)
    {
        var fieldGo = new GameObject("RoomNameField", typeof(RectTransform), typeof(Image));
        fieldGo.transform.SetParent(parent, false);
        var fieldImage = fieldGo.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(fieldImage, 16);
        fieldImage.color = new Color(0.94f, 0.94f, 0.96f, 1f);

        var fieldRt = fieldGo.GetComponent<RectTransform>();
        fieldRt.anchorMin = new Vector2(0.08f, 0.38f);
        fieldRt.anchorMax = new Vector2(0.92f, 0.62f);
        fieldRt.offsetMin = Vector2.zero;
        fieldRt.offsetMax = Vector2.zero;

        var textGo = new GameObject("Text", typeof(RectTransform), typeof(Text));
        textGo.transform.SetParent(fieldGo.transform, false);
        var text = textGo.GetComponent<Text>();
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.supportRichText = false;
        text.color = Ink;
        text.fontSize = 24;
        text.alignment = TextAnchor.MiddleLeft;
        var textRt = textGo.GetComponent<RectTransform>();
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(16f, 8f);
        textRt.offsetMax = new Vector2(-16f, -8f);

        var placeholderGo = new GameObject("Placeholder", typeof(RectTransform), typeof(Text));
        placeholderGo.transform.SetParent(fieldGo.transform, false);
        var placeholder = placeholderGo.GetComponent<Text>();
        placeholder.font = text.font;
        placeholder.text = "Living room";
        placeholder.color = InkMuted;
        placeholder.fontSize = 24;
        placeholder.alignment = TextAnchor.MiddleLeft;
        var placeholderRt = placeholderGo.GetComponent<RectTransform>();
        placeholderRt.anchorMin = Vector2.zero;
        placeholderRt.anchorMax = Vector2.one;
        placeholderRt.offsetMin = new Vector2(16f, 8f);
        placeholderRt.offsetMax = new Vector2(-16f, -8f);

        var input = fieldGo.AddComponent<InputField>();
        input.textComponent = text;
        input.placeholder = placeholder;
        input.lineType = InputField.LineType.SingleLine;
        return input;
    }

    static Button CreateTextButton(Transform parent, string label, Vector2 anchorMin, Vector2 anchorMax, Action onClick)
    {
        var go = new GameObject(label + "Button", typeof(RectTransform), typeof(Button));
        go.transform.SetParent(parent, false);
        var button = go.GetComponent<Button>();
        button.targetGraphic = null;
        button.onClick.AddListener(() => onClick?.Invoke());

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        var text = ARDesignUiUtil.CreateText(go.transform, label, 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = Accent;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = Vector2.zero;
        textRt.offsetMax = Vector2.zero;
        return button;
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

        text = ARDesignUiUtil.CreateText(go.transform, label, 20, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = textColor;
        text.horizontalOverflow = HorizontalWrapMode.Overflow;
        text.verticalOverflow = VerticalWrapMode.Truncate;
        text.resizeTextForBestFit = false;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(12f, 4f);
        textRt.offsetMax = new Vector2(-12f, -4f);
        return button;
    }
}
