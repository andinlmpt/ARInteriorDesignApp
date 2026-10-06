using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// Standalone MainMenu launcher — builds a branded, touch-friendly UI at runtime.
/// </summary>
public class MainMenuController : MonoBehaviour
{
    [SerializeField] private string furnitureSceneName = "ARDesignScene";
    [SerializeField] private string measurementSceneName = "ARRoomMeasurement";
    [SerializeField] private bool rebuildUiOnAwake = true;

    [SerializeField] private Button furnitureButton;
    [SerializeField] private Button measurementButton;

    static readonly Color Navy = new(12f / 255f, 41f / 255f, 95f / 255f, 1f);
    static readonly Color NavySoft = new(12f / 255f, 41f / 255f, 95f / 255f, 0.10f);
    static readonly Color Ivory = new(0.980f, 0.976f, 0.969f, 1f);
    static readonly Color Ink = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color InkMuted = new(0.42f, 0.43f, 0.46f, 1f);
    static readonly Color Card = new(1f, 1f, 1f, 0.98f);
    static readonly Color White = Color.white;

    Canvas canvas;

    void Awake()
    {
        // MainMenu has no RN bridge, so the host app would never get unityReady.
        // Hand off to a bridged scene; RN then routes to measurement or furniture.
        if (ARDesignHostDetect.IsEmbeddedInReactNative())
        {
            enabled = false;
            SceneManager.LoadScene(furnitureSceneName);
            return;
        }

        if (rebuildUiOnAwake)
            BuildBrandedUi();

        WireButton(furnitureButton, LoadFurnitureScene);
        WireButton(measurementButton, LoadMeasurementScene);
    }

    void OnDestroy()
    {
        UnwireButton(furnitureButton, LoadFurnitureScene);
        UnwireButton(measurementButton, LoadMeasurementScene);
    }

    static void WireButton(Button button, UnityEngine.Events.UnityAction action)
    {
        if (button == null) return;
        button.onClick.RemoveListener(action);
        button.onClick.AddListener(action);
    }

    static void UnwireButton(Button button, UnityEngine.Events.UnityAction action)
    {
        if (button == null) return;
        button.onClick.RemoveListener(action);
    }

    public void LoadFurnitureScene()
    {
        SceneManager.LoadScene(furnitureSceneName);
    }

    public void LoadMeasurementScene()
    {
        SceneManager.LoadScene(measurementSceneName);
    }

    void BuildBrandedUi()
    {
        // Hide any old scene-authored menu canvas so we don't double-draw.
        foreach (var existing in FindObjectsByType<Canvas>(FindObjectsSortMode.None))
        {
            if (existing != null && existing.gameObject.name.Contains("MainMenu"))
                existing.gameObject.SetActive(false);
        }

        ARDesignUiUtil.EnsureEventSystem();

        if (Camera.main != null)
        {
            Camera.main.clearFlags = CameraClearFlags.SolidColor;
            Camera.main.backgroundColor = Ivory;
        }

        var root = new GameObject("MainMenuCanvas");
        root.transform.SetParent(transform, false);
        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        // Soft page background
        var bg = ARDesignUiUtil.CreateImage(root.transform, Ivory);
        StretchFull(bg.rectTransform);

        // Ambient navy blobs for atmosphere (not flat single-color page)
        // Ambient blobs kept clear of the centered logo
        CreateAmbientBlob(root.transform, new Vector2(-460f, 720f), 360f, NavySoft);
        CreateAmbientBlob(root.transform, new Vector2(460f, -620f), 340f, NavySoft);

        var content = new GameObject("Content", typeof(RectTransform));
        content.transform.SetParent(root.transform, false);
        var contentRt = content.GetComponent<RectTransform>();
        contentRt.anchorMin = new Vector2(0.5f, 0.5f);
        contentRt.anchorMax = new Vector2(0.5f, 0.5f);
        contentRt.pivot = new Vector2(0.5f, 0.5f);
        contentRt.sizeDelta = new Vector2(920f, 1400f);
        contentRt.anchoredPosition = Vector2.zero;

        // Brand logo
        CreateLogoBadge(content.transform, new Vector2(0f, 540f));

        // App title under logo
        var title = ARDesignUiUtil.CreateText(content.transform, "AR Interior Design", 40, FontStyle.Bold, TextAnchor.MiddleCenter);
        title.color = Ink;
        title.horizontalOverflow = HorizontalWrapMode.Overflow;
        var titleRt = title.rectTransform;
        titleRt.anchorMin = new Vector2(0.5f, 0.5f);
        titleRt.anchorMax = new Vector2(0.5f, 0.5f);
        titleRt.pivot = new Vector2(0.5f, 0.5f);
        titleRt.sizeDelta = new Vector2(860f, 56f);
        titleRt.anchoredPosition = new Vector2(0f, 290f);

        var subtitle = ARDesignUiUtil.CreateText(
            content.transform,
            "Your vision, Our craft",
            22,
            FontStyle.Normal,
            TextAnchor.MiddleCenter);
        subtitle.color = InkMuted;
        subtitle.horizontalOverflow = HorizontalWrapMode.Wrap;
        var subRt = subtitle.rectTransform;
        subRt.anchorMin = new Vector2(0.5f, 0.5f);
        subRt.anchorMax = new Vector2(0.5f, 0.5f);
        subRt.pivot = new Vector2(0.5f, 0.5f);
        subRt.sizeDelta = new Vector2(780f, 48f);
        subRt.anchoredPosition = new Vector2(0f, 235f);

        // Action cards
        furnitureButton = CreateActionCard(
            content.transform,
            "FurnitureCard",
            new Vector2(0f, -20f),
            LoadUiSprite("UIIcons/cube-icon") ?? LoadUiSprite("FurnitureIcons/japan-sofa"),
            "AR Furniture",
            "Place and preview 3D furniture in your space",
            LoadFurnitureScene);

        measurementButton = CreateActionCard(
            content.transform,
            "MeasurementCard",
            new Vector2(0f, -260f),
            null,
            "AR Measurement",
            "Scan room height & corners, then generate a layout",
            LoadMeasurementScene,
            drawRulerIcon: true);

        var footer = ARDesignUiUtil.CreateText(
            content.transform,
            "Choose a mode to get started",
            18,
            FontStyle.Normal,
            TextAnchor.MiddleCenter);
        footer.color = InkMuted;
        var footerRt = footer.rectTransform;
        footerRt.anchorMin = new Vector2(0.5f, 0.5f);
        footerRt.anchorMax = new Vector2(0.5f, 0.5f);
        footerRt.sizeDelta = new Vector2(700f, 40f);
        footerRt.anchoredPosition = new Vector2(0f, -460f);
    }

    void CreateLogoBadge(Transform parent, Vector2 anchoredPos)
    {
        const float logoSize = 640f;

        var logoGo = new GameObject("LogoBadge", typeof(RectTransform), typeof(Image));
        logoGo.transform.SetParent(parent, false);
        var logoImg = logoGo.GetComponent<Image>();
        logoImg.raycastTarget = false;
        logoImg.preserveAspect = true;
        logoImg.type = Image.Type.Simple;
        logoImg.color = Color.white;

        var logoRt = logoImg.rectTransform;
        logoRt.anchorMin = new Vector2(0.5f, 0.5f);
        logoRt.anchorMax = new Vector2(0.5f, 0.5f);
        logoRt.pivot = new Vector2(0.5f, 0.5f);
        logoRt.sizeDelta = new Vector2(logoSize, logoSize);
        logoRt.anchoredPosition = anchoredPos;

        // New PNG logo with black backdrop punched to transparent — no square/mask border.
        var logoSprite = LoadMaharlikaLogoTransparent();
        if (logoSprite != null)
        {
            logoImg.sprite = logoSprite;
        }
        else
        {
            ARDesignUiUtil.ApplyCircle(logoImg);
            logoImg.color = Navy;
            logoImg.sprite = DrawSofaLogoFallback();
        }
    }

    static Sprite LoadMaharlikaLogoTransparent()
    {
        var tex = Resources.Load<Texture2D>("UIIcons/maharlika-logo");
        if (tex == null)
        {
            // Unity may import as Sprite-only; pull pixels from the sprite texture.
            var sprite = Resources.Load<Sprite>("UIIcons/maharlika-logo");
            if (sprite == null) return null;
            tex = sprite.texture;
        }

        if (tex == null) return null;

        // Copy into a readable runtime texture and clear near-black backdrop.
        var w = tex.width;
        var h = tex.height;
        var readable = new Texture2D(w, h, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.HideAndDontSave,
        };

        // Blit via RenderTexture so we don't depend on Read/Write import flags.
        var tmp = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32);
        Graphics.Blit(tex, tmp);
        var prev = RenderTexture.active;
        RenderTexture.active = tmp;
        readable.ReadPixels(new Rect(0, 0, w, h), 0, 0);
        readable.Apply(false, false);
        RenderTexture.active = prev;
        RenderTexture.ReleaseTemporary(tmp);

        var pixels = readable.GetPixels32();
        for (var i = 0; i < pixels.Length; i++)
        {
            var p = pixels[i];
            // Punch out solid black / near-black background outside the emblem.
            if (p.r < 28 && p.g < 28 && p.b < 28)
                pixels[i] = new Color32(0, 0, 0, 0);
        }

        readable.SetPixels32(pixels);
        readable.Apply(false, true);
        return Sprite.Create(readable, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100f);
    }

    Button CreateActionCard(
        Transform parent,
        string name,
        Vector2 anchoredPos,
        Sprite iconSprite,
        string title,
        string description,
        UnityEngine.Events.UnityAction onClick,
        bool drawRulerIcon = false)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);

        var bg = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(bg, 28);
        bg.color = Navy;

        var button = go.GetComponent<Button>();
        button.targetGraphic = bg;
        var colors = button.colors;
        colors.highlightedColor = new Color(0.12f, 0.24f, 0.48f, 1f);
        colors.pressedColor = new Color(0.06f, 0.14f, 0.32f, 1f);
        button.colors = colors;
        button.onClick.AddListener(onClick);

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(820f, 168f);
        rt.anchoredPosition = anchoredPos;

        // Left icon circle
        var iconBadge = new GameObject("IconBadge", typeof(RectTransform), typeof(Image));
        iconBadge.transform.SetParent(go.transform, false);
        var iconBadgeImg = iconBadge.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(iconBadgeImg);
        iconBadgeImg.color = new Color(1f, 1f, 1f, 0.16f);
        iconBadgeImg.raycastTarget = false;
        var iconBadgeRt = iconBadge.GetComponent<RectTransform>();
        iconBadgeRt.anchorMin = new Vector2(0f, 0.5f);
        iconBadgeRt.anchorMax = new Vector2(0f, 0.5f);
        iconBadgeRt.pivot = new Vector2(0f, 0.5f);
        iconBadgeRt.anchoredPosition = new Vector2(28f, 0f);
        iconBadgeRt.sizeDelta = new Vector2(88f, 88f);

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(iconBadge.transform, false);
        var icon = iconGo.GetComponent<Image>();
        icon.preserveAspect = true;
        icon.raycastTarget = false;
        icon.color = White;
        if (drawRulerIcon)
            icon.sprite = DrawRulerIcon();
        else if (iconSprite != null)
            icon.sprite = iconSprite;
        else
            icon.sprite = LoadUiSprite("UIIcons/cube-icon");

        var iconRt = icon.rectTransform;
        iconRt.anchorMin = new Vector2(0.2f, 0.2f);
        iconRt.anchorMax = new Vector2(0.8f, 0.8f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;

        var titleText = ARDesignUiUtil.CreateText(go.transform, title, 30, FontStyle.Bold, TextAnchor.MiddleLeft);
        titleText.color = White;
        titleText.raycastTarget = false;
        var titleRt = titleText.rectTransform;
        titleRt.anchorMin = new Vector2(0f, 0.5f);
        titleRt.anchorMax = new Vector2(1f, 0.5f);
        titleRt.pivot = new Vector2(0f, 0.5f);
        titleRt.anchoredPosition = new Vector2(140f, 22f);
        titleRt.sizeDelta = new Vector2(620f, 40f);

        var descText = ARDesignUiUtil.CreateText(go.transform, description, 18, FontStyle.Normal, TextAnchor.MiddleLeft);
        descText.color = new Color(1f, 1f, 1f, 0.78f);
        descText.raycastTarget = false;
        descText.horizontalOverflow = HorizontalWrapMode.Wrap;
        var descRt = descText.rectTransform;
        descRt.anchorMin = new Vector2(0f, 0.5f);
        descRt.anchorMax = new Vector2(1f, 0.5f);
        descRt.pivot = new Vector2(0f, 0.5f);
        descRt.anchoredPosition = new Vector2(140f, -24f);
        descRt.sizeDelta = new Vector2(620f, 48f);

        // Chevron hint
        var chevron = ARDesignUiUtil.CreateText(go.transform, "›", 42, FontStyle.Bold, TextAnchor.MiddleCenter);
        chevron.color = new Color(1f, 1f, 1f, 0.7f);
        chevron.raycastTarget = false;
        var chevRt = chevron.rectTransform;
        chevRt.anchorMin = new Vector2(1f, 0.5f);
        chevRt.anchorMax = new Vector2(1f, 0.5f);
        chevRt.pivot = new Vector2(1f, 0.5f);
        chevRt.anchoredPosition = new Vector2(-28f, 0f);
        chevRt.sizeDelta = new Vector2(48f, 48f);

        return button;
    }

    static void CreateAmbientBlob(Transform parent, Vector2 pos, float size, Color color)
    {
        var go = new GameObject("Ambient", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        var img = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(img);
        img.color = color;
        img.raycastTarget = false;
        var rt = img.rectTransform;
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(size, size);
        rt.anchoredPosition = pos;
    }

    static void StretchFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    static Sprite LoadUiSprite(string resourcesPath)
    {
        var sprite = Resources.Load<Sprite>(resourcesPath);
        if (sprite != null) return sprite;

        var tex = Resources.Load<Texture2D>(resourcesPath);
        if (tex == null) return null;

        return Sprite.Create(
            tex,
            new Rect(0f, 0f, tex.width, tex.height),
            new Vector2(0.5f, 0.5f),
            100f);
    }

    static Sprite DrawRulerIcon()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            hideFlags = HideFlags.HideAndDontSave,
        };
        var clear = new Color(0f, 0f, 0f, 0f);
        var ink = Color.white;
        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
            tex.SetPixel(x, y, clear);

        // Ruler body
        for (var x = 10; x <= 54; x++)
        for (var y = 24; y <= 40; y++)
            tex.SetPixel(x, y, ink);

        // Tick marks
        for (var i = 0; i < 6; i++)
        {
            var tx = 14 + i * 8;
            for (var y = 40; y <= 48; y++)
            for (var x = tx; x <= tx + 2; x++)
                tex.SetPixel(x, y, ink);
        }

        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static Sprite DrawSofaLogoFallback()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            hideFlags = HideFlags.HideAndDontSave,
        };
        var clear = new Color(0f, 0f, 0f, 0f);
        var ink = Color.white;
        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
            tex.SetPixel(x, y, clear);

        // Seat
        for (var x = 12; x <= 52; x++)
        for (var y = 18; y <= 30; y++)
            tex.SetPixel(x, y, ink);
        // Back
        for (var x = 12; x <= 52; x++)
        for (var y = 30; y <= 46; y++)
            tex.SetPixel(x, y, ink);
        // Legs
        for (var y = 10; y <= 18; y++)
        {
            tex.SetPixel(16, y, ink);
            tex.SetPixel(17, y, ink);
            tex.SetPixel(46, y, ink);
            tex.SetPixel(47, y, ink);
        }

        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }
}
