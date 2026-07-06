using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Tutorial-style AR reticle: raycasts from screen center and snaps to detected planes.
/// Based on the standard AR Foundation placement indicator pattern.
/// </summary>
public class ARPlacementIndicator : MonoBehaviour
{
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private Renderer indicatorRenderer;
    [Tooltip("0 = bottom, 0.5 = center (tutorial default), 1 = top")]
    [SerializeField] private float screenY = 0.5f;
    [SerializeField] private bool alignToPlaneRotation = true;
    [SerializeField] private bool horizontalSurfacesOnly = true;

    private readonly List<ARRaycastHit> hits = new();
    private bool isTracking;
    private Vector2 screenPointOverride = Vector2.negativeInfinity;

    public bool IsVisible { get; private set; }
    public Pose CurrentPose { get; private set; }

    void Awake()
    {
        if (raycastManager == null)
        {
            raycastManager = FindFirstObjectByType<ARRaycastManager>();
        }

        if (indicatorRenderer == null)
        {
            indicatorRenderer = GetComponentInChildren<Renderer>();
        }

        SetVisible(false);
    }

    void Update()
    {
        if (!isTracking || raycastManager == null)
        {
            return;
        }

        var screenPoint = screenPointOverride.x >= 0f
            ? screenPointOverride
            : new Vector2(Screen.width * 0.5f, Screen.height * screenY);

        if (!raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
        {
            SetVisible(false);
            return;
        }

        var pose = hits[0].pose;

        if (horizontalSurfacesOnly && Vector3.Dot(pose.up, Vector3.up) < 0.85f)
        {
            SetVisible(false);
            return;
        }

        CurrentPose = pose;
        transform.SetPositionAndRotation(
            pose.position,
            alignToPlaneRotation ? pose.rotation : Quaternion.identity);
        SetVisible(true);
    }

    public void StartTracking()
    {
        isTracking = true;
        screenPointOverride = Vector2.negativeInfinity;
    }

    public void StartTracking(Vector2 screenPoint)
    {
        isTracking = true;
        screenPointOverride = screenPoint;
    }

    public void StopTracking()
    {
        isTracking = false;
        screenPointOverride = Vector2.negativeInfinity;
        SetVisible(false);
    }

    void SetVisible(bool visible)
    {
        IsVisible = visible;

        if (indicatorRenderer != null)
        {
            indicatorRenderer.enabled = visible;
        }
    }
}
