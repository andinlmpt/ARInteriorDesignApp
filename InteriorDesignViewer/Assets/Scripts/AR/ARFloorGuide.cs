using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Controls AR plane mesh visibility (floor grid). Wired from ARFurniturePlacer.OnFurniturePlacedEvent.
/// </summary>
public class ARFloorGuide : MonoBehaviour
{
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private float          hideAfterPlacementDelay = 2f;

    bool planesVisible = true;

    void Awake()
    {
        if (planeManager == null)
            planeManager = FindFirstObjectByType<ARPlaneManager>();
    }

    void OnEnable()
    {
        if (planeManager != null)
            planeManager.trackablesChanged.AddListener(OnTrackablesChanged);
    }

    void OnDisable()
    {
        if (planeManager != null)
            planeManager.trackablesChanged.RemoveListener(OnTrackablesChanged);
    }

    /// <summary>Called by UnityEvent after furniture is placed.</summary>
    public void HidePlanesAfterDelay() => StartCoroutine(HideAfterDelay());

    public void TogglePlanesVisible()
    {
        SetPlanesVisible(!planesVisible);
    }

    public void SetPlanesVisible(bool visible)
    {
        planesVisible = visible;
        ApplyVisibilityToAllPlanes();
    }

    IEnumerator HideAfterDelay()
    {
        yield return new WaitForSeconds(hideAfterPlacementDelay);
        SetPlanesVisible(false);
    }

    void OnTrackablesChanged(ARTrackablesChangedEventArgs<ARPlane> args)
    {
        if (planesVisible)
            return;

        foreach (var plane in args.added)
            SetPlaneVisible(plane, false);
    }

    void ApplyVisibilityToAllPlanes()
    {
        if (planeManager == null)
            return;

        foreach (var plane in planeManager.trackables)
            SetPlaneVisible(plane, planesVisible);
    }

    static void SetPlaneVisible(ARPlane plane, bool visible)
    {
        if (plane == null)
            return;

        foreach (var renderer in plane.GetComponentsInChildren<Renderer>())
            renderer.enabled = visible;
    }
}
