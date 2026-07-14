using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Applies colors to vertical AR planes using custom per-wall material instances.
/// Allows multiple walls to hold unique colors, with optional smooth fade transitions.
/// </summary>
public class WallPainter : MonoBehaviour
{
    [Header("Paint Configuration")]
    [Tooltip("Base material template for transparent paint overlay. If null, creates a dynamic URP transparent unlit material.")]
    [SerializeField] private Material paintMaterialTemplate;
    
    [Range(0f, 1f)]
    [Tooltip("Opacity of the paint coat. Lower values allow more of the real-world wall texture/shadows to bleed through.")]
    [SerializeField] private float paintAlpha = 0.8f;

    [Header("Transitions")]
    [Tooltip("Enables/disables smooth color blending transitions instead of instant color swaps.")]
    [SerializeField] private bool useTransitions = true;
    [SerializeField] private float transitionDuration = 0.3f;

    // Maps to store state per plane
    private readonly Dictionary<ARPlane, Material> originalMaterials = new();
    private readonly Dictionary<ARPlane, Material> paintedMaterials = new();
    private readonly Dictionary<ARPlane, Coroutine> activeTransitions = new();

    /// <summary>
    /// Checks if a given plane has currently been painted.
    /// </summary>
    public bool IsPlanePainted(ARPlane plane)
    {
        return paintedMaterials.ContainsKey(plane);
    }

    /// <summary>
    /// Colors the specified ARPlane. Creates a new unique material instance for the plane if none exists.
    /// </summary>
    public void PaintWall(ARPlane plane, Color color)
    {
        if (plane == null)
        {
            Debug.LogWarning("[WallPainter] PaintWall called with null plane!");
            return;
        }

        var meshRenderer = plane.GetComponentInChildren<MeshRenderer>();
        if (meshRenderer == null)
        {
            Debug.LogWarning($"[WallPainter] No MeshRenderer found on wall {plane.trackableId}. Cannot paint.");
            return;
        }

        Debug.Log($"[WallPainter] Painting wall {plane.trackableId} with color {color}");

        // Cache original visualizer material if we haven't already
        if (!originalMaterials.ContainsKey(plane))
        {
            originalMaterials[plane] = meshRenderer.sharedMaterial;
        }

        // Create or reuse a unique paint material instance per plane
        if (!paintedMaterials.TryGetValue(plane, out var paintMat))
        {
            paintMat = paintMaterialTemplate != null
                ? Instantiate(paintMaterialTemplate)
                : CreateDefaultPaintMaterial();

            paintedMaterials[plane] = paintMat;
        }

        // Formulate target color with alpha channel
        Color targetColor = color;
        targetColor.a = paintAlpha;

        // Apply color immediately BEFORE assigning to renderer (avoids 1-frame flicker)
        ApplyColorToMaterial(paintMat, targetColor);

        // Assign paint material to the renderer so it shows up
        meshRenderer.material = paintMat;
        meshRenderer.enabled = true;

        Debug.Log($"[WallPainter] Material assigned. Color applied: {targetColor}. Renderer enabled: {meshRenderer.enabled}");

        // Optionally layer a smooth transition on top
        if (useTransitions && gameObject.activeInHierarchy)
        {
            if (activeTransitions.TryGetValue(plane, out var activeCoroutine))
            {
                StopCoroutine(activeCoroutine);
            }
            activeTransitions[plane] = StartCoroutine(TransitionColorCoroutine(plane, paintMat, targetColor));
        }
    }

    /// <summary>
    /// Reverts the specified wall to its original AR visualizer material.
    /// </summary>
    public void ResetWall(ARPlane plane)
    {
        if (plane == null) return;

        // Cancel any running fade animations
        if (activeTransitions.TryGetValue(plane, out var coroutine))
        {
            StopCoroutine(coroutine);
            activeTransitions.Remove(plane);
        }

        var meshRenderer = plane.GetComponentInChildren<MeshRenderer>();
        if (meshRenderer != null && originalMaterials.TryGetValue(plane, out var originalMat))
        {
            meshRenderer.material = originalMat;
        }

        // Clean up the instantiated material to prevent memory leaks
        if (paintedMaterials.TryGetValue(plane, out var paintMat))
        {
            Destroy(paintMat);
            paintedMaterials.Remove(plane);
        }

        originalMaterials.Remove(plane);
    }

    private System.Collections.IEnumerator TransitionColorCoroutine(ARPlane plane, Material mat, Color targetColor)
    {
        Color startColor = GetMaterialColor(mat);

        float elapsed = 0f;
        while (elapsed < transitionDuration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / transitionDuration;
            Color lerpedColor = Color.Lerp(startColor, targetColor, t);
            ApplyColorToMaterial(mat, lerpedColor);
            yield return null;
        }

        ApplyColorToMaterial(mat, targetColor);
        activeTransitions.Remove(plane);
    }

    private Color GetMaterialColor(Material mat)
    {
        if (mat == null) return Color.white;

        if (mat.HasProperty("_BaseColor"))
            return mat.GetColor("_BaseColor");
        if (mat.HasProperty("_Color"))
            return mat.GetColor("_Color");

        return Color.white;
    }

    private void ApplyColorToMaterial(Material mat, Color color)
    {
        if (mat == null) return;

        // Support both URP (_BaseColor) and Legacy (_Color) properties safely without throwing exceptions
        if (mat.HasProperty("_BaseColor"))
            mat.SetColor("_BaseColor", color);
        else if (mat.HasProperty("_Color"))
            mat.SetColor("_Color", color);
    }

    /// <summary>
    /// Generates a clean unlit transparent material designed for URP.
    /// </summary>
    private Material CreateDefaultPaintMaterial()
    {
        // Try multiple shaders in order of preference
        Shader shader = null;
        
        shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) shader = Shader.Find("Unlit/Transparent");
        if (shader == null) shader = Shader.Find("Sprites/Default");
        if (shader == null) shader = Shader.Find("UI/Default");
        if (shader == null)
        {
            Debug.LogError("[WallPainter] No suitable shader found! Using fallback.");
            return new Material(Shader.Find("Hidden/InternalErrorShader"));
        }

        Debug.Log($"[WallPainter] Creating paint material with shader: {shader.name}");
        var material = new Material(shader);

        if (shader.name.Contains("Universal Render Pipeline"))
        {
            // URP Transparent surface setup
            material.SetFloat("_Surface", 1f);        // 0 = Opaque, 1 = Transparent
            material.SetFloat("_Blend", 0f);          // 0 = Alpha
            material.SetFloat("_AlphaClip", 0f);
            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0);
            material.SetInt("_Cull", 2);              // Back-face culling
            material.DisableKeyword("_ALPHATEST_ON");
            material.EnableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        }
        else
        {
            // Legacy / Sprites / UI shader transparent setup
            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0);
            material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        }

        return material;
    }

    void OnDestroy()
    {
        // Prevent material leaks
        foreach (var mat in paintedMaterials.Values)
        {
            if (mat != null) Destroy(mat);
        }
    }
}
