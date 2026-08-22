using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

/// <summary>Shared UI helpers that must not crash the Android player.</summary>
public static class ARDesignUiUtil
{
    static Font cachedFont;

    public static Font SafeFont()
    {
        if (cachedFont != null) return cachedFont;

        cachedFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        if (cachedFont == null)
            cachedFont = Resources.GetBuiltinResource<Font>("Arial.ttf");
        if (cachedFont == null)
        {
            try
            {
                cachedFont = Font.CreateDynamicFontFromOSFont(
                    new[] { "sans-serif", "Roboto", "Arial", "Helvetica" }, 28);
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[ARDesignUiUtil] OS font unavailable: {e.Message}");
            }
        }

        return cachedFont;
    }

    public static Text CreateText(Transform parent, string value, int size, FontStyle style, TextAnchor anchor)
    {
        var go = new GameObject("Text", typeof(RectTransform), typeof(Text));
        go.transform.SetParent(parent, false);
        var text = go.GetComponent<Text>();
        text.font = SafeFont();
        if (text.font == null)
        {
            Object.Destroy(go);
            var fallback = new GameObject("TextFallback", typeof(RectTransform));
            fallback.transform.SetParent(parent, false);
            var rtFallback = fallback.GetComponent<RectTransform>();
            rtFallback.offsetMin = Vector2.zero;
            rtFallback.offsetMax = Vector2.zero;
            var dummy = fallback.AddComponent<Text>();
            dummy.enabled = false;
            dummy.text = value;
            return dummy;
        }

        text.text = value;
        text.fontSize = size;
        text.fontStyle = style;
        text.alignment = anchor;
        text.color = Color.white;
        text.horizontalOverflow = HorizontalWrapMode.Wrap;
        text.verticalOverflow = VerticalWrapMode.Truncate;
        text.supportRichText = false;

        var rt = text.rectTransform;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        return text;
    }

    public static Image CreateImage(Transform parent, Color color)
    {
        var go = new GameObject("Image", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        var image = go.GetComponent<Image>();
        image.color = color;
        image.raycastTarget = true;
        return image;
    }

    /// <summary>Rounded rectangle sprite generated at runtime (9-sliced).</summary>
    public static Sprite RoundedSprite(int radius = 28, int size = 128)
    {
        radius = Mathf.Clamp(radius, 4, size / 2 - 1);
        var key = $"r{radius}_s{size}";
        if (roundedCache.TryGetValue(key, out var cached) && cached != null)
            return cached;

        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;

        var clear = new Color(1f, 1f, 1f, 0f);
        var solid = Color.white;
        var pixels = new Color[size * size];
        var r2 = radius * radius;

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var dx = 0;
                var dy = 0;
                if (x < radius && y < radius)
                {
                    dx = radius - x;
                    dy = radius - y;
                }
                else if (x >= size - radius && y < radius)
                {
                    dx = x - (size - radius - 1);
                    dy = radius - y;
                }
                else if (x < radius && y >= size - radius)
                {
                    dx = radius - x;
                    dy = y - (size - radius - 1);
                }
                else if (x >= size - radius && y >= size - radius)
                {
                    dx = x - (size - radius - 1);
                    dy = y - (size - radius - 1);
                }

                var inside = dx == 0 && dy == 0 || dx * dx + dy * dy <= r2;
                pixels[y * size + x] = inside ? solid : clear;
            }
        }

        tex.SetPixels(pixels);
        tex.Apply(false, true);

        var border = radius;
        var sprite = Sprite.Create(
            tex,
            new Rect(0, 0, size, size),
            new Vector2(0.5f, 0.5f),
            100f,
            0,
            SpriteMeshType.FullRect,
            new Vector4(border, border, border, border));

        roundedCache[key] = sprite;
        return sprite;
    }

    public static Image CreateRoundedImage(Transform parent, Color color, int radius = 28)
    {
        var image = CreateImage(parent, color);
        image.sprite = RoundedSprite(radius);
        image.type = Image.Type.Sliced;
        image.pixelsPerUnitMultiplier = 1.6f;
        return image;
    }

    public static void ApplyRounded(Image image, int radius = 28)
    {
        if (image == null) return;
        image.sprite = RoundedSprite(radius);
        image.type = Image.Type.Sliced;
        image.pixelsPerUnitMultiplier = 1.6f;
    }

    static readonly System.Collections.Generic.Dictionary<string, Sprite> roundedCache = new();

    public static void EnsureEventSystem()
    {
        if (Object.FindFirstObjectByType<EventSystem>() != null) return;

        try
        {
            var go = new GameObject("EventSystem");
            go.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
            go.AddComponent<InputSystemUIInputModule>();
#elif ENABLE_INPUT_SYSTEM
            try { go.AddComponent<InputSystemUIInputModule>(); }
            catch { go.AddComponent<StandaloneInputModule>(); }
#else
            go.AddComponent<StandaloneInputModule>();
#endif
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARDesignUiUtil] EventSystem setup failed: {e.Message}");
        }
    }
}

/// <summary>
/// Detects when this Unity player is hosted inside the React Native / Expo activity
/// rather than a standalone Unity Build And Run activity.
/// </summary>
public static class ARDesignHostDetect
{
    static int cached = -1;

    public static bool IsEmbeddedInReactNative()
    {
        if (cached >= 0) return cached == 1;

#if UNITY_EDITOR
        cached = 0;
        return false;
#elif UNITY_ANDROID
        try
        {
            using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
            using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            if (activity == null)
            {
                cached = 0;
                return false;
            }

            using var cls = activity.Call<AndroidJavaObject>("getClass");
            var name = cls != null ? cls.Call<string>("getName") : string.Empty;

            // Unity 6 Build And Run often uses UnityPlayerGameActivity (not
            // UnityPlayerActivity). Only treat as RN when the host is clearly
            // outside com.unity3d.player.*.
            var standalone = string.IsNullOrEmpty(name)
                             || name.IndexOf("com.unity3d.player", System.StringComparison.OrdinalIgnoreCase) >= 0
                             || name.IndexOf("UnityPlayer", System.StringComparison.OrdinalIgnoreCase) >= 0;
            var embedded = !standalone;
            cached = embedded ? 1 : 0;
            Debug.Log($"[ARDesignHostDetect] activity={name} embedded={embedded}");
            return embedded;
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARDesignHostDetect] {e.Message}");
            cached = 0;
            return false;
        }
#else
        cached = 0;
        return false;
#endif
    }
}
