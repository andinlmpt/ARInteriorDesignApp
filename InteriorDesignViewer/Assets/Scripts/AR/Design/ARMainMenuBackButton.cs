using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// Top-left back control that returns to the MainMenu launcher scene.
/// Used by standalone AR Furniture / AR Measurement builds (not RN-embedded).
/// </summary>
[DefaultExecutionOrder(-60)]
public class ARMainMenuBackButton : MonoBehaviour
{
    [SerializeField] private string mainMenuSceneName = "MainMenu";
    [SerializeField] private bool enableNativeButton = true;

    static readonly Color Frost = new(1f, 1f, 1f, 0.94f);
    static readonly Color Ink = new(0.10f, 0.10f, 0.12f, 1f);

    bool built;
    Canvas canvas;

    public static ARMainMenuBackButton EnsureOn(GameObject host)
    {
        if (host == null) return null;
        var existing = Object.FindFirstObjectByType<ARMainMenuBackButton>();
        if (existing != null) return existing;
        return host.AddComponent<ARMainMenuBackButton>();
    }

    /// <summary>Hide/show the floating back control (e.g. when another HUD owns Back).</summary>
    public static void SetUiVisible(bool visible)
    {
        var instance = Object.FindFirstObjectByType<ARMainMenuBackButton>();
        if (instance == null) return;
        if (instance.canvas != null)
            instance.canvas.gameObject.SetActive(visible);
    }

    void Awake()
    {
        // RN owns back navigation when Unity is embedded — avoid duplicate chrome.
        if (!enableNativeButton || ARDesignHostDetect.IsEmbeddedInReactNative())
        {
            enabled = false;
            return;
        }

        BuildUi();
    }

    void BuildUi()
    {
        if (built) return;
        built = true;

        ARDesignUiUtil.EnsureEventSystem();

        var root = new GameObject("ARMainMenuBackButtonUI");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 1200;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        var go = new GameObject("BackButton", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(root.transform, false);

        var image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(image);
        image.color = Frost;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(OnBackClicked);

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(24f, -44f);
        rt.sizeDelta = new Vector2(120f, 120f);

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        var iconImage = iconGo.GetComponent<Image>();
        iconImage.sprite = LoadBackArrowSprite();
        iconImage.preserveAspect = true;
        iconImage.raycastTarget = false;
        iconImage.color = Ink;
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;
    }

    static Sprite LoadBackArrowSprite()
    {
        var sprite = Resources.Load<Sprite>("UIIcons/back-arrow");
        if (sprite != null) return sprite;

        var tex = Resources.Load<Texture2D>("UIIcons/back-arrow");
        if (tex != null)
        {
            return Sprite.Create(
                tex,
                new Rect(0f, 0f, tex.width, tex.height),
                new Vector2(0.5f, 0.5f),
                100f);
        }

        // Procedural fallback if the asset hasn't imported yet.
        return DrawBackArrowFallback();
    }

    static Sprite DrawBackArrowFallback()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var clear = new Color(0f, 0f, 0f, 0f);
        var ink = Color.white;
        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
            tex.SetPixel(x, y, clear);

        // Circle outline
        var cx = size * 0.5f;
        var cy = size * 0.5f;
        var r = 26f;
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var d = Mathf.Abs(Mathf.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r);
                if (d < 2.2f) tex.SetPixel(x, y, ink);
            }
        }

        // Left arrow shaft + head
        for (var x = 22; x <= 42; x++)
        for (var y = 30; y <= 34; y++)
            tex.SetPixel(x, y, ink);
        for (var i = 0; i <= 10; i++)
        {
            for (var t = -2; t <= 2; t++)
            {
                tex.SetPixel(22 + i, 32 + i + t, ink);
                tex.SetPixel(22 + i, 32 - i + t, ink);
            }
        }

        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    void OnBackClicked()
    {
        if (ARDesignHostDetect.IsEmbeddedInReactNative())
        {
            var measurementBridge = Object.FindFirstObjectByType<ARMeasurementRnBridge>();
            if (measurementBridge != null)
            {
                measurementBridge.RequestClose();
                return;
            }

            UnityMessageBridge.SendToApp("requestClose", "ARDesignScene");
            return;
        }

        if (string.IsNullOrWhiteSpace(mainMenuSceneName))
            return;

        SceneManager.LoadScene(mainMenuSceneName);
    }
}
