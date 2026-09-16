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

    /// <summary>Filled circle sprite (Image.Type.Simple) — use for true circular buttons.</summary>
    public static Sprite CircleSprite(int size = 128)
    {
        size = Mathf.Clamp(size, 32, 256);
        var key = $"circle_{size}";
        if (roundedCache.TryGetValue(key, out var cached) && cached != null)
            return cached;

        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            wrapMode = TextureWrapMode.Clamp,
            filterMode = FilterMode.Bilinear,
            hideFlags = HideFlags.HideAndDontSave,
        };

        var clear = new Color(1f, 1f, 1f, 0f);
        var solid = Color.white;
        var pixels = new Color[size * size];
        var cx = (size - 1) * 0.5f;
        var cy = (size - 1) * 0.5f;
        var r = size * 0.5f - 0.5f;
        var r2 = r * r;

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var dx = x - cx;
                var dy = y - cy;
                pixels[y * size + x] = dx * dx + dy * dy <= r2 ? solid : clear;
            }
        }

        tex.SetPixels(pixels);
        tex.Apply(false, true);

        var sprite = Sprite.Create(
            tex,
            new Rect(0, 0, size, size),
            new Vector2(0.5f, 0.5f),
            100f,
            0,
            SpriteMeshType.FullRect);

        roundedCache[key] = sprite;
        return sprite;
    }

    public static void ApplyCircle(Image image)
    {
        if (image == null) return;
        image.sprite = CircleSprite(128);
        image.type = Image.Type.Simple;
        image.preserveAspect = true;
        image.pixelsPerUnitMultiplier = 1f;
    }

    /// <summary>Hollow circle stroke (transparent center) for border-only rings.</summary>
    public static Sprite CircleRingSprite(int size = 128, float thicknessNormalized = 0.06f)
    {
        size = Mathf.Clamp(size, 32, 256);
        var thicknessPx = Mathf.Clamp(Mathf.RoundToInt(size * thicknessNormalized), 2, size / 4);
        var key = $"circle_ring_{size}_{thicknessPx}";
        if (roundedCache.TryGetValue(key, out var cached) && cached != null)
            return cached;

        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            wrapMode = TextureWrapMode.Clamp,
            filterMode = FilterMode.Bilinear,
            hideFlags = HideFlags.HideAndDontSave,
        };

        var clear = new Color(1f, 1f, 1f, 0f);
        var solid = Color.white;
        var pixels = new Color[size * size];
        var cx = (size - 1) * 0.5f;
        var cy = (size - 1) * 0.5f;
        var outerR = size * 0.5f - 0.5f;
        var innerR = Mathf.Max(0f, outerR - thicknessPx);
        var outerR2 = outerR * outerR;
        var innerR2 = innerR * innerR;

        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var dx = x - cx;
                var dy = y - cy;
                var d2 = dx * dx + dy * dy;
                pixels[y * size + x] = d2 <= outerR2 && d2 >= innerR2 ? solid : clear;
            }
        }

        tex.SetPixels(pixels);
        tex.Apply(false, true);

        var sprite = Sprite.Create(
            tex,
            new Rect(0, 0, size, size),
            new Vector2(0.5f, 0.5f),
            100f,
            0,
            SpriteMeshType.FullRect);

        roundedCache[key] = sprite;
        return sprite;
    }

    public static void ApplyCircleRing(Image image, float thicknessNormalized = 0.06f)
    {
        if (image == null) return;
        image.sprite = CircleRingSprite(128, thicknessNormalized);
        image.type = Image.Type.Simple;
        image.preserveAspect = true;
        image.pixelsPerUnitMultiplier = 1f;
    }

    static readonly System.Collections.Generic.Dictionary<string, Sprite> roundedCache = new();
    static readonly System.Collections.Generic.Dictionary<int, Sprite> punchedIconCache = new();

    /// <summary>
    /// Removes studio white/near-white backgrounds that touch the image edges,
    /// so product thumbnails match transparent silhouette icons in the picker.
    /// </summary>
    public static Sprite PunchStudioBackground(Sprite source, float whiteness = 0.90f)
    {
        if (source == null || source.texture == null) return source;

        var key = source.GetEntityId().GetHashCode();
        if (punchedIconCache.TryGetValue(key, out var cached) && cached != null)
            return cached;

        Texture2D readable = null;
        try
        {
            readable = CopySpriteToReadableTexture(source);
            if (readable == null) return source;

            var w = readable.width;
            var h = readable.height;
            var pixels = readable.GetPixels32();
            var visited = new bool[pixels.Length];
            var queue = new System.Collections.Generic.Queue<int>(w * 4 + h * 4);

            void EnqueueIfBg(int x, int y)
            {
                if (x < 0 || y < 0 || x >= w || y >= h) return;
                var i = y * w + x;
                if (visited[i]) return;
                if (!IsNearWhite(pixels[i], whiteness)) return;
                visited[i] = true;
                queue.Enqueue(i);
            }

            for (var x = 0; x < w; x++)
            {
                EnqueueIfBg(x, 0);
                EnqueueIfBg(x, h - 1);
            }
            for (var y = 0; y < h; y++)
            {
                EnqueueIfBg(0, y);
                EnqueueIfBg(w - 1, y);
            }

            while (queue.Count > 0)
            {
                var i = queue.Dequeue();
                pixels[i] = new Color32(pixels[i].r, pixels[i].g, pixels[i].b, 0);
                var x = i % w;
                var y = i / w;
                EnqueueIfBg(x - 1, y);
                EnqueueIfBg(x + 1, y);
                EnqueueIfBg(x, y - 1);
                EnqueueIfBg(x, y + 1);
            }

            readable.SetPixels32(pixels);
            readable.Apply(false, true);

            var sprite = Sprite.Create(
                readable,
                new Rect(0, 0, w, h),
                new Vector2(0.5f, 0.5f),
                source.pixelsPerUnit > 0 ? source.pixelsPerUnit : 100f,
                0,
                SpriteMeshType.FullRect);
            sprite.name = source.name + "_punched";
            punchedIconCache[key] = sprite;
            return sprite;
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARDesignUiUtil] PunchStudioBackground failed for {source.name}: {e.Message}");
            if (readable != null)
                Object.Destroy(readable);
            return source;
        }
    }

    static bool IsNearWhite(Color32 c, float whiteness)
    {
        if (c.a < 8) return true;
        var threshold = (byte)Mathf.Clamp(Mathf.RoundToInt(whiteness * 255f), 0, 255);
        return c.r >= threshold && c.g >= threshold && c.b >= threshold;
    }

    static Texture2D CopySpriteToReadableTexture(Sprite source)
    {
        var tex = source.texture;
        if (tex == null) return null;

        var rect = source.textureRect;
        var w = Mathf.Max(1, Mathf.RoundToInt(rect.width));
        var h = Mathf.Max(1, Mathf.RoundToInt(rect.height));

        // Fast path when the source texture is readable.
        try
        {
            if (tex.isReadable)
            {
                var copy = new Texture2D(w, h, TextureFormat.RGBA32, false)
                {
                    wrapMode = TextureWrapMode.Clamp,
                    filterMode = FilterMode.Bilinear,
                    hideFlags = HideFlags.HideAndDontSave,
                };
                var pixels = tex.GetPixels(
                    Mathf.RoundToInt(rect.x),
                    Mathf.RoundToInt(rect.y),
                    w,
                    h);
                copy.SetPixels(pixels);
                copy.Apply(false, false);
                return copy;
            }
        }
        catch
        {
            // Fall through to blit path.
        }

        var rt = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32);
        var prev = RenderTexture.active;
        try
        {
            // Blit only the sprite's atlas rect into a readable texture.
            var scale = new Vector2(rect.width / tex.width, rect.height / tex.height);
            var offset = new Vector2(rect.x / tex.width, rect.y / tex.height);
            Graphics.Blit(tex, rt, scale, offset);

            RenderTexture.active = rt;
            var copy = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                hideFlags = HideFlags.HideAndDontSave,
            };
            copy.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            copy.Apply(false, false);
            return copy;
        }
        finally
        {
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
        }
    }

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
