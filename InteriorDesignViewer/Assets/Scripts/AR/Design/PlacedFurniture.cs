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

    /// <summary>Local scale that makes the model match RequestedDimensions. This is 1.0x.</summary>
    public Vector3 TrueScale { get; private set; } = Vector3.one;

    /// <summary>Local bounds of the model at unit scale, used for grounding and outlines.</summary>
    public Bounds LocalBounds { get; private set; }

    /// <summary>Which workspace this piece belongs to (AR vs Plan). Hidden in the other view.</summary>
    public ARDesignLayoutModeController.ViewMode PlacementSpace { get; private set; } =
        ARDesignLayoutModeController.ViewMode.RealRoom;

    public bool IsSelected { get; private set; }

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
        ARDesignLayoutModeController.ViewMode placementSpace)
    {
        InstanceId = instanceId;
        ModelId = modelId;
        RequestedDimensions = requestedDimensions;
        TrueScale = trueScale;
        LocalBounds = localBounds;
        PlacementSpace = placementSpace;
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

        if (outline == null)
        {
            if (!selected) return;

            outline = GetComponent<ARDragOutline>();
            if (outline == null)
            {
                outline = gameObject.AddComponent<ARDragOutline>();
                if (ARFurnitureGrounding.TryGetLocalFurnitureBounds(gameObject, out var bounds))
                    outline.SetupOutline(bounds);
            }
        }

        outline.SetVisible(selected);
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
