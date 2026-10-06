using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Identity + real-world sizing metadata for one placed furniture instance.
/// Attached by <see cref="FurniturePlacementController"/> at spawn time and read
/// by the manipulator, the layout serializer and the glTF exporter.
///
/// SCALE MODEL
/// Pieces keep the model's authored size (<see cref="TrueScale"/> is always
/// 1,1,1). Gestures may rotate and drag, but they never rescale.
/// </summary>
public class PlacedFurniture : MonoBehaviour
{
    /// <summary>Unique per-session id, e.g. "fur-3".</summary>
    public string InstanceId { get; private set; }

    /// <summary>Catalog id supplied by RN. Written into the exported glTF node name.</summary>
    public string ModelId { get; private set; }

    /// <summary>Real-world size in metres requested by RN. Zero when unspecified.</summary>
    public Vector3 RequestedDimensions { get; private set; }

    /// <summary>Authoritative catalog size in metres (width=x, height=y, depth=z).</summary>
    public Vector3 CatalogDimensions { get; private set; }

    /// <summary>Exact label from the product reference sheet.</summary>
    public string DimensionLabel { get; private set; }

    /// <summary>Local scale that makes the model match RequestedDimensions. This is 1.0x.</summary>
    public Vector3 TrueScale { get; private set; } = Vector3.one;

    /// <summary>Local bounds of the model at unit scale, used for grounding and outlines.</summary>
    public Bounds LocalBounds { get; private set; }

    /// <summary>Which workspace this piece belongs to (AR vs Plan). Hidden in the other view.</summary>
    public ARDesignLayoutModeController.ViewMode PlacementSpace { get; private set; } =
        ARDesignLayoutModeController.ViewMode.RealRoom;

    public bool IsSelected { get; private set; }

    /// <summary>"#RRGGBB" tint chosen by the user; empty keeps the model's own colours.</summary>
    public string ColorHex { get; private set; } = string.Empty;

    static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
    static readonly int ColorId = Shader.PropertyToID("_Color");

    /// <summary>Live-AR world anchor that keeps this piece locked to the real room.</summary>
    public ARAnchor WorldAnchor { get; private set; }

    /// <summary>Current pinch multiplier relative to <see cref="TrueScale"/>.</summary>
    public float ScaleMultiplier
    {
        get
        {
            var trueX = TrueScale.x;
            return Mathf.Approximately(trueX, 0f) ? 1f : transform.localScale.x / trueX;
        }
    }

    /// <summary>World-space size of the instance at its current scale.</summary>
    public Vector3 CurrentDimensions
    {
        get
        {
            var size = LocalBounds.size;
            var scale = transform.localScale;
            return new Vector3(
                Mathf.Abs(size.x * scale.x),
                Mathf.Abs(size.y * scale.y),
                Mathf.Abs(size.z * scale.z));
        }
    }

    ARDragOutline outline;

    public void Initialize(
        string instanceId,
        string modelId,
        Vector3 requestedDimensions,
        Vector3 trueScale,
        Bounds localBounds,
        ARDesignLayoutModeController.ViewMode placementSpace,
        Vector3 catalogDimensions,
        string dimensionLabel)
    {
        InstanceId = instanceId;
        ModelId = modelId;
        RequestedDimensions = requestedDimensions;
        CatalogDimensions = catalogDimensions;
        DimensionLabel = dimensionLabel ?? string.Empty;
        TrueScale = trueScale;
        LocalBounds = localBounds;
        PlacementSpace = placementSpace;

        // Dimension chip is shown in React Native overlay — do not attach a world-space label.
        var existingLabel = GetComponent<FurnitureDimensionLabel>();
        if (existingLabel != null)
            Destroy(existingLabel);
    }

    public void SetPlacementSpace(ARDesignLayoutModeController.ViewMode space)
    {
        PlacementSpace = space;
    }

    public void BindWorldAnchor(ARAnchor anchor)
    {
        WorldAnchor = anchor;
    }

    /// <summary>
    /// Detach from the tracked anchor so drag/scale can move freely in world space.
    /// Optionally destroys the orphaned anchor GameObject.
    /// </summary>
    public void UnbindWorldAnchor(Transform fallbackParent, bool destroyAnchor)
    {
        if (WorldAnchor == null)
        {
            if (fallbackParent != null && transform.parent != fallbackParent)
                transform.SetParent(fallbackParent, true);
            return;
        }

        var anchor = WorldAnchor;
        WorldAnchor = null;
        transform.SetParent(fallbackParent, true);

        if (destroyAnchor && anchor != null)
            Destroy(anchor.gameObject);
    }

    /// <summary>Toggles the "this is the piece your gestures affect" highlight.</summary>
    public void SetSelected(bool selected)
    {
        IsSelected = selected;

        if (!selected)
        {
            if (outline != null)
            {
                outline.SetVisible(false);
                outline.SetPlacementSafe(true);
            }
            return;
        }

        if (outline == null)
        {
            outline = GetComponent<ARDragOutline>();
            if (outline == null)
                outline = gameObject.AddComponent<ARDragOutline>();
        }

        ConfigureOutlineGeometry();
        outline.SetVisible(true);
        outline.SetPlacementSafe(true);
    }

    void ConfigureOutlineGeometry()
    {
        if (outline == null) return;
        if (ARFurnitureGrounding.TryGetLocalFurnitureBounds(gameObject, out var bounds))
            outline.SetupOutline(bounds);
        else if (LocalBounds.size.sqrMagnitude > 1e-6f)
            outline.SetupOutline(LocalBounds);
    }

    /// <summary>Updates the floor outline color for placement safety feedback.</summary>
    public void ApplyPlacementSafety(bool isSafe)
    {
        if (outline == null)
            outline = GetComponent<ARDragOutline>();
        if (outline == null) return;
        outline.SetPlacementSafe(isSafe);
    }

    /// <summary>
    /// Recolours the model's meshes. Uses property blocks so shared GLB materials (and other
    /// instances of the same model) stay untouched; an empty or invalid hex restores the original.
    /// </summary>
    public void ApplyColor(string hex)
    {
        var hasTint = !string.IsNullOrWhiteSpace(hex) && ColorUtility.TryParseHtmlString(hex, out _);
        ColorUtility.TryParseHtmlString(hex ?? string.Empty, out var tint);
        ColorHex = hasTint ? hex.Trim() : string.Empty;

        var block = new MaterialPropertyBlock();
        foreach (var r in GetComponentsInChildren<Renderer>(true))
        {
            // Selection outline and other line helpers keep their own colours.
            if (r is LineRenderer) continue;

            if (!hasTint)
            {
                r.SetPropertyBlock(null);
                continue;
            }

            r.GetPropertyBlock(block);
            block.SetColor(BaseColorId, tint);
            block.SetColor(ColorId, tint);
            r.SetPropertyBlock(block);
        }
    }

    public PlacedFurniturePayload ToPayload()
    {
        return new PlacedFurniturePayload
        {
            instanceId = InstanceId,
            modelId = ModelId,
            position = new ARDesignVec3(transform.position),
            rotationY = Mathf.Repeat(transform.eulerAngles.y, 360f),
            scale = ScaleMultiplier,
            dimensions = new ARDesignVec3(CurrentDimensions),
            selected = IsSelected,
            colorHex = ColorHex,
        };
    }

    void OnDestroy()
    {
        if (WorldAnchor == null) return;
        var anchor = WorldAnchor;
        WorldAnchor = null;
        if (anchor != null)
            Destroy(anchor.gameObject);
    }
}
