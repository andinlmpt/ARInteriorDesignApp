using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Keeps AR plane / point-cloud / mesh debug geometry hidden for the whole
/// session. Detection still runs (for corner raycasts), but the translucent
/// plane washes must never appear — ARPlaneMeshVisualizer can re-enable
/// renderers on every plane update, so we also disable those components and
/// re-hide every frame.
/// </summary>
[DefaultExecutionOrder(-135)]
public class ScanVisualizationController : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARPointCloudManager pointCloudManager;
    [SerializeField] private ARMeshManager meshManager;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (pointCloudManager == null) pointCloudManager = FindFirstObjectByType<ARPointCloudManager>();
        if (meshManager == null) meshManager = FindFirstObjectByType<ARMeshManager>();

        HideAllVisuals();
    }

    void OnEnable()
    {
        if (scanController != null)
            scanController.PhaseChanged += OnPhaseChanged;

        if (planeManager != null)
            planeManager.trackablesChanged.AddListener(OnPlanesChanged);

        if (pointCloudManager != null)
            pointCloudManager.trackablesChanged.AddListener(OnPointCloudsChanged);
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhaseChanged;

        if (planeManager != null)
            planeManager.trackablesChanged.RemoveListener(OnPlanesChanged);

        if (pointCloudManager != null)
            pointCloudManager.trackablesChanged.RemoveListener(OnPointCloudsChanged);
    }

    void Start() => HideAllVisuals();

    void LateUpdate()
    {
        // Plane mesh visualizers turn renderers back on when boundaries update.
        HideAllVisuals();
    }

    void OnPhaseChanged(RoomScanController.ScanPhase phase) => HideAllVisuals();

    void OnPlanesChanged(ARTrackablesChangedEventArgs<ARPlane> args)
    {
        foreach (var plane in args.added)
            HideTrackable(plane);
        foreach (var plane in args.updated)
            HideTrackable(plane);
    }

    void OnPointCloudsChanged(ARTrackablesChangedEventArgs<ARPointCloud> args)
    {
        foreach (var cloud in args.added)
            HideTrackable(cloud);
        foreach (var cloud in args.updated)
            HideTrackable(cloud);
    }

    public void HideAllVisuals()
    {
        if (planeManager != null)
        {
            foreach (var plane in planeManager.trackables)
                HideTrackable(plane);
        }

        if (pointCloudManager != null)
        {
            foreach (var cloud in pointCloudManager.trackables)
                HideTrackable(cloud);
        }

        if (meshManager != null)
        {
            foreach (var renderer in meshManager.GetComponentsInChildren<Renderer>(true))
                renderer.enabled = false;
        }
    }

    static void HideTrackable(Component trackable)
    {
        if (trackable == null) return;

        foreach (var visualizer in trackable.GetComponentsInChildren<ARPlaneMeshVisualizer>(true))
            visualizer.enabled = false;

        foreach (var renderer in trackable.GetComponentsInChildren<Renderer>(true))
            renderer.enabled = false;

        foreach (var line in trackable.GetComponentsInChildren<LineRenderer>(true))
            line.enabled = false;
    }
}
