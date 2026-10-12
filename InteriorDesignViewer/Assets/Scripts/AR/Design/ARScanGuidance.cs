using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Live coaching while scanning: turns ARCore tracking problems, fast phone movement and
/// "not aiming at the floor" into one short instruction ("Move slowly", "Too dark", …).
/// A problem must last a moment before it shows, and stays up briefly after it clears,
/// so the message doesn't flicker.
/// </summary>
public class ARScanGuidance : MonoBehaviour
{
    public enum Issue
    {
        None,
        Starting,
        Relocalizing,
        TooDark,
        TooFast,
        LowDetail,
        NoFloor,
    }

    [Tooltip("Turning faster than this (degrees per second) shows \"Move slowly\".")]
    [SerializeField] private float fastTurnDegreesPerSecond = 80f;
    [Tooltip("Moving faster than this (metres per second) shows \"Move slowly\".")]
    [SerializeField] private float fastMoveMetresPerSecond = 0.9f;
    [Tooltip("Seconds a problem must last before it is shown.")]
    [SerializeField] private float showAfterSeconds = 0.4f;
    [Tooltip("Seconds a message stays up after the problem clears.")]
    [SerializeField] private float holdSeconds = 1.5f;
    [Tooltip("Seconds without a floor aim before \"Point at the floor\" is shown.")]
    [SerializeField] private float noFloorAfterSeconds = 2.5f;

    public Issue Current { get; private set; }

    public string Title => Current switch
    {
        Issue.Starting => "Getting ready…",
        Issue.Relocalizing => "Finding your place again",
        Issue.TooDark => "Too dark",
        Issue.TooFast => "Move slowly",
        Issue.LowDetail => "Point at something with more detail",
        Issue.NoFloor => "Point at the floor",
        _ => string.Empty,
    };

    public string Detail => Current switch
    {
        Issue.Starting => "Move the phone slowly so it can see the room",
        Issue.Relocalizing => "Point back at the area you already scanned",
        Issue.TooDark => "Turn on a light or open the curtains",
        Issue.TooFast => "Slow, steady sweeps keep the measurements accurate",
        Issue.LowDetail => "Plain walls are hard to track. Include edges, furniture or the floor",
        Issue.NoFloor => "Aim the camera down until the marker is on the floor",
        _ => string.Empty,
    };

    /// <summary>
    /// Whether the current step needs the camera aimed at the floor, and whether it is.
    /// Null when the step doesn't need the floor (e.g. aiming at the ceiling for height).
    /// </summary>
    public bool? FloorAim { get; set; }

    Camera arCamera;
    bool hasLastPose;
    Vector3 lastPosition;
    Quaternion lastRotation;
    float turnSpeed;
    float moveSpeed;
    Issue candidate;
    float candidateSince;
    float shownUntil;
    float floorMissingSince = -1f;

    public static ARScanGuidance EnsureOn(GameObject host)
    {
        var existing = host.GetComponent<ARScanGuidance>();
        return existing != null ? existing : host.AddComponent<ARScanGuidance>();
    }

    void OnDisable()
    {
        Current = Issue.None;
        candidate = Issue.None;
        hasLastPose = false;
        floorMissingSince = -1f;
    }

    void Update()
    {
        var now = Time.unscaledTime;
        var detected = Detect(now);

        if (detected != candidate)
        {
            candidate = detected;
            candidateSince = now;
        }

        if (candidate != Issue.None && now - candidateSince >= showAfterSeconds)
        {
            Current = candidate;
            shownUntil = now + holdSeconds;
        }
        else if (now >= shownUntil)
        {
            Current = Issue.None;
        }
    }

    Issue Detect(float now)
    {
        // Sample every frame so the speed never compares against a stale pose.
        var movingFast = MeasureMotion();

        // ARCore's own reason wins: it knows why tracking is struggling.
        switch (ARSession.notTrackingReason)
        {
            case NotTrackingReason.InsufficientLight: return Issue.TooDark;
            case NotTrackingReason.ExcessiveMotion: return Issue.TooFast;
            case NotTrackingReason.InsufficientFeatures: return Issue.LowDetail;
            case NotTrackingReason.Relocalizing: return Issue.Relocalizing;
            case NotTrackingReason.Initializing: return Issue.Starting;
        }

        if (movingFast)
            return Issue.TooFast;

        if (FloorAim == false)
        {
            if (floorMissingSince < 0f) floorMissingSince = now;
            if (now - floorMissingSince >= noFloorAfterSeconds) return Issue.NoFloor;
        }
        else
        {
            floorMissingSince = -1f;
        }

        return Issue.None;
    }

    /// <summary>Smoothed camera speed; true while the phone is moving too fast for good tracking.</summary>
    bool MeasureMotion()
    {
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null || ARSession.state != ARSessionState.SessionTracking)
        {
            hasLastPose = false;
            return false;
        }

        var t = arCamera.transform;
        var dt = Time.unscaledDeltaTime;
        if (hasLastPose && dt > 1e-4f)
        {
            var turn = Quaternion.Angle(lastRotation, t.rotation) / dt;
            var move = Vector3.Distance(lastPosition, t.position) / dt;
            // ~0.25 s smoothing so one jittery frame doesn't trigger the warning.
            var k = 1f - Mathf.Exp(-dt / 0.25f);
            turnSpeed = Mathf.Lerp(turnSpeed, turn, k);
            moveSpeed = Mathf.Lerp(moveSpeed, move, k);
        }

        lastRotation = t.rotation;
        lastPosition = t.position;
        hasLastPose = true;

        return turnSpeed > fastTurnDegreesPerSecond || moveSpeed > fastMoveMetresPerSecond;
    }
}
