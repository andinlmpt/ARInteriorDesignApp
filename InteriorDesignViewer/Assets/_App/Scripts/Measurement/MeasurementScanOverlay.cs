using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Full-screen scanning UI shown before the placement indicator appears.
/// </summary>
public class MeasurementScanOverlay : MonoBehaviour
{
    [Header("Panels")]
    [SerializeField] private CanvasGroup overlayGroup;
    [SerializeField] private GameObject centerGraphicRoot;
    [SerializeField] private GameObject measurementControlsRoot;

    [Header("Text")]
    [SerializeField] private TMP_Text topBannerText;
    [SerializeField] private TMP_Text bottomPromptText;
    [SerializeField] private Image centerPulseRing;

    [Header("Animation")]
    [SerializeField] private float pulseSpeed = 2.5f;
    [SerializeField] private float pulseMinScale = 0.92f;
    [SerializeField] private float pulseMaxScale = 1.08f;

    MeasurementScanController scanController;
    float pulseTime;

    void Awake()
    {
        scanController = FindFirstObjectByType<MeasurementScanController>();
        EnsureRuntimeUi();
    }

    void OnEnable()
    {
        if (scanController != null)
        {
            scanController.OnPhaseChanged += HandlePhaseChanged;
            scanController.OnProgressChanged += HandleProgressChanged;
            scanController.OnHintChanged += HandleHintChanged;
            ApplyPhase(scanController.Phase, scanController.ScanProgress);
            HandleHintChanged(scanController.Phase == MeasurementScanController.ScanPhase.Ready
                ? "Floor ready — tap to place the first point."
                : "Move phone to start");
        }
        else
        {
            SetOverlayVisible(true);
        }
    }

    void OnDisable()
    {
        if (scanController != null)
        {
            scanController.OnPhaseChanged -= HandlePhaseChanged;
            scanController.OnProgressChanged -= HandleProgressChanged;
            scanController.OnHintChanged -= HandleHintChanged;
        }
    }

    void Update()
    {
        if (centerPulseRing == null || overlayGroup == null || overlayGroup.alpha <= 0.01f)
            return;

        pulseTime += Time.deltaTime * pulseSpeed;
        var scale = Mathf.Lerp(pulseMinScale, pulseMaxScale, (Mathf.Sin(pulseTime) + 1f) * 0.5f);
        centerPulseRing.rectTransform.localScale = Vector3.one * scale;
    }

    void HandlePhaseChanged(MeasurementScanController.ScanPhase phase)
    {
        ApplyPhase(phase, scanController != null ? scanController.ScanProgress : 1f);
    }

    void HandleProgressChanged(float progress)
    {
        if (scanController != null && scanController.Phase == MeasurementScanController.ScanPhase.Scanning)
            ApplyPhase(MeasurementScanController.ScanPhase.Scanning, progress);
    }

    void HandleHintChanged(string hint)
    {
        if (topBannerText != null)
            topBannerText.text = hint;

        if (bottomPromptText != null && scanController != null &&
            scanController.Phase == MeasurementScanController.ScanPhase.Scanning)
            bottomPromptText.text = "Move phone to start";
    }

    void ApplyPhase(MeasurementScanController.ScanPhase phase, float progress)
    {
        var scanning = phase == MeasurementScanController.ScanPhase.Scanning;
        SetOverlayVisible(scanning);

        if (centerGraphicRoot != null)
            centerGraphicRoot.SetActive(scanning);

        if (measurementControlsRoot != null)
            measurementControlsRoot.SetActive(!scanning);

        if (bottomPromptText != null)
            bottomPromptText.gameObject.SetActive(scanning && progress <= 0.15f);
    }

    void SetOverlayVisible(bool visible)
    {
        if (overlayGroup == null)
            return;

        overlayGroup.alpha = visible ? 1f : 0f;
        overlayGroup.interactable = visible;
        overlayGroup.blocksRaycasts = visible;
    }

    void EnsureRuntimeUi()
    {
        if (overlayGroup != null && topBannerText != null)
            return;

        var canvas = GetComponent<Canvas>();
        if (canvas == null)
            canvas = gameObject.AddComponent<Canvas>();

        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 20;

        if (GetComponent<CanvasScaler>() == null)
        {
            var scaler = gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
        }

        if (GetComponent<GraphicRaycaster>() == null)
            gameObject.AddComponent<GraphicRaycaster>();

        overlayGroup = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();

        var bannerGo = CreateUiObject("ScanBanner", transform);
        var bannerRect = bannerGo.GetComponent<RectTransform>();
        bannerRect.anchorMin = new Vector2(0.08f, 0.82f);
        bannerRect.anchorMax = new Vector2(0.92f, 0.9f);
        bannerRect.offsetMin = Vector2.zero;
        bannerRect.offsetMax = Vector2.zero;
        var bannerBg = bannerGo.AddComponent<Image>();
        bannerBg.color = new Color(0.12f, 0.12f, 0.14f, 0.72f);
        topBannerText = CreateText(bannerGo.transform, "BannerText", 24, TextAlignmentOptions.Center);

        centerGraphicRoot = CreateUiObject("ScanCenterGraphic", transform);
        var centerRect = centerGraphicRoot.GetComponent<RectTransform>();
        centerRect.anchorMin = new Vector2(0.5f, 0.5f);
        centerRect.anchorMax = new Vector2(0.5f, 0.5f);
        centerRect.sizeDelta = new Vector2(260f, 260f);
        centerRect.anchoredPosition = Vector2.zero;

        centerPulseRing = CreateUiObject("PulseRing", centerGraphicRoot.transform).AddComponent<Image>();
        centerPulseRing.color = new Color(1f, 1f, 1f, 0.18f);
        centerPulseRing.rectTransform.sizeDelta = new Vector2(220f, 220f);

        var grid = CreateUiObject("GridHint", centerGraphicRoot.transform);
        var gridRect = grid.GetComponent<RectTransform>();
        gridRect.sizeDelta = new Vector2(180f, 180f);
        var gridText = CreateText(grid.transform, "GridText", 64, TextAlignmentOptions.Center);
        gridText.text = "⌁";
        gridText.color = new Color(1f, 1f, 1f, 0.85f);

        bottomPromptText = CreateText(transform, "BottomPrompt", 34, TextAlignmentOptions.Center);
        var bottomRect = bottomPromptText.rectTransform;
        bottomRect.anchorMin = new Vector2(0.1f, 0.12f);
        bottomRect.anchorMax = new Vector2(0.9f, 0.18f);
        bottomRect.offsetMin = Vector2.zero;
        bottomRect.offsetMax = Vector2.zero;
        bottomPromptText.fontStyle = FontStyles.Bold;
        bottomPromptText.text = "Move phone to start";
    }

    static GameObject CreateUiObject(string name, Transform parent)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        return go;
    }

    static TMP_Text CreateText(Transform parent, string name, float fontSize, TextAlignmentOptions alignment)
    {
        var go = CreateUiObject(name, parent);
        var rect = go.GetComponent<RectTransform>();
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;

        var text = go.AddComponent<TextMeshProUGUI>();
        text.fontSize = fontSize;
        text.alignment = alignment;
        text.color = Color.white;
        text.raycastTarget = false;
        return text;
    }

    public void SetMeasurementControlsRoot(GameObject controlsRoot)
    {
        measurementControlsRoot = controlsRoot;
    }
}
