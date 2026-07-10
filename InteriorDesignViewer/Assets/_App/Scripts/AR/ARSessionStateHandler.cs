using System;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Maps ARSession.state to user-facing scan hints for HUD overlays.
/// MeasurementHUDController subscribes to OnHintChanged.
/// </summary>
public class ARSessionStateHandler : MonoBehaviour
{
    public event Action<string> OnHintChanged;

    [SerializeField] private ARSession arSession;

    string lastHint = string.Empty;

    void Awake()
    {
        if (arSession == null)
            arSession = FindFirstObjectByType<ARSession>();
    }

    void OnEnable()
    {
        ARSession.stateChanged += OnStateChanged;
        PublishHint(ResolveHint(ARSession.state));
    }

    void OnDisable()
    {
        ARSession.stateChanged -= OnStateChanged;
    }

    void OnStateChanged(ARSessionStateChangedEventArgs args)
    {
        PublishHint(ResolveHint(args.state));
    }

    void PublishHint(string hint)
    {
        if (hint == lastHint)
            return;

        lastHint = hint;
        OnHintChanged?.Invoke(hint);
    }

    static string ResolveHint(ARSessionState state)
    {
        return state switch
        {
            ARSessionState.None           => "Initializing AR…",
            ARSessionState.Unsupported    => "AR is not supported on this device.",
            ARSessionState.CheckingAvailability => "Checking AR availability…",
            ARSessionState.NeedsInstall   => "Installing ARCore…",
            ARSessionState.Installing       => "Installing ARCore…",
            ARSessionState.Ready            => "Move your phone to scan the floor.",
            ARSessionState.SessionInitializing => "Starting AR session…",
            ARSessionState.SessionTracking  => "Floor detected — tap to place a point.",
            _                               => "Scanning environment…",
        };
    }
}
