using System;
using UnityEngine;

/// <summary>
/// RN pointer router for the measured-room planner.
///   1 finger on a piece        → select + drag.
///   1 finger tap on empty      → deselect.
///   2 fingers on/around a piece → select + rotate (twist).
///   2 fingers on empty space    → orbit + pinch zoom.
/// Rotate vs orbit is decided once when the second finger lands and held until release.
/// RN sends x/y in physical pixels (top-left origin); dx/dy stay in dp for orbit tuning.
/// </summary>
public class PlannerRnInputRouter : MonoBehaviour
{
    enum Mode
    {
        None,
        Pending,
        Drag,
        Rotate,
        Orbit,
    }

    const float TapSlopPx = 24f;
    /// <summary>Extra hit area around a piece's on-screen footprint, in inches.</summary>
    const float DragPadInches = 0.2f;
    const float RotatePadInches = 0.45f;
    const float MinTwistDeg = 0.01f;

    Mode mode;
    Vector2 pendingUnityScreen;
    FurniturePlacementController placement;
    FurnitureManipulator manipulator;
    ARDesignLayoutModeController layout;
    Camera arCamera;

    public static PlannerRnInputRouter EnsureOn(GameObject host)
    {
        if (host == null) return null;
        var existing = host.GetComponent<PlannerRnInputRouter>();
        if (existing != null) return existing;
        return host.AddComponent<PlannerRnInputRouter>();
    }

    void Awake()
    {
        Rebind();
    }

    public void Rebind()
    {
        if (placement == null) placement = FindFirstObjectByType<FurniturePlacementController>();
        if (manipulator == null) manipulator = FindFirstObjectByType<FurnitureManipulator>();
        if (layout == null) layout = FindFirstObjectByType<ARDesignLayoutModeController>();
        if (arCamera == null) arCamera = Camera.main;
    }

    /// <summary>
    /// Payload: phase begin|move|end|cancel, x/y (+x2/y2 for two fingers) in RN top-left pixels,
    /// dx/dy (dp), pinch, twistDelta (deg), fingers.
    /// </summary>
    public void Apply(string json)
    {
        Rebind();

        PlannerPointerRnPayload payload = null;
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                payload = JsonUtility.FromJson<PlannerPointerRnPayload>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[PlannerRnInputRouter] Bad payload: {e.Message}");
                return;
            }
        }

        if (payload == null) return;

        var phase = (payload.phase ?? string.Empty).Trim().ToLowerInvariant();
        var screen = RnToUnityScreen(payload.x, payload.y);

        if (phase == "end" || phase == "cancel")
        {
            Finish(phase, screen, payload);
            return;
        }

        if (payload.fingers >= 2)
        {
            HandleTwoFinger(phase, screen, RnToUnityScreen(payload.x2, payload.y2), payload);
            return;
        }

        // Lifting one finger of a rotate/orbit must not turn into a drag.
        if (mode == Mode.Rotate || mode == Mode.Orbit)
            return;

        if (phase == "begin")
        {
            pendingUnityScreen = screen;
            if (TryPickFurniture(screen, PadPx(DragPadInches), out var hit))
            {
                placement.Select(hit);
                mode = Mode.Drag;
                SendManipulator("begin", payload.x, payload.y);
            }
            else
            {
                // Deselect only on tap release — a second finger may still be coming.
                mode = Mode.Pending;
            }

            return;
        }

        if (phase == "move" && mode == Mode.Drag)
            SendManipulator("move", payload.x, payload.y, payload.dx, payload.dy);
    }

    void HandleTwoFinger(string phase, Vector2 a, Vector2 b, PlannerPointerRnPayload payload)
    {
        if (mode != Mode.Rotate && mode != Mode.Orbit)
        {
            if (mode == Mode.Drag)
                SendManipulator("end", payload.x, payload.y);

            var mid = (a + b) * 0.5f;
            if (TryPickForRotate(a, b, mid, out var target))
            {
                placement.Select(target);
                mode = Mode.Rotate;
                var midRn = UnityToRnScreen(mid);
                SendManipulator("begin", midRn.x, midRn.y);
                Debug.Log($"[PlannerRnInputRouter] Rotate begin on {target.name}");
            }
            else
            {
                mode = Mode.Orbit;
            }
        }

        if (mode == Mode.Rotate)
        {
            var twist = payload.twistDelta;
            if (Mathf.Abs(twist) < MinTwistDeg)
                return;

            var midRn = UnityToRnScreen((a + b) * 0.5f);
            if (manipulator != null)
            {
                manipulator.ApplyGestureFromRn(JsonUtility.ToJson(new FurnitureGestureRnPayload
                {
                    phase = "move",
                    x = midRn.x,
                    y = midRn.y,
                    twistDelta = twist,
                }));
            }

            return;
        }

        if (layout != null)
        {
            layout.ApplyOrbitFromRn(JsonUtility.ToJson(new OrbitPayload
            {
                dx = payload.dx,
                dy = payload.dy,
                pinch = payload.pinch > 0.01f ? payload.pinch : 1f,
            }));
        }
    }

    void Finish(string phase, Vector2 screen, PlannerPointerRnPayload payload)
    {
        if (mode == Mode.Drag || mode == Mode.Rotate)
        {
            SendManipulator(phase, payload.x, payload.y);
        }
        else if (mode == Mode.Pending && placement != null && phase == "end")
        {
            if (Vector2.Distance(screen, pendingUnityScreen) < TapSlopPx)
            {
                placement.Select(TryPickFurniture(screen, PadPx(DragPadInches), out var hit) ? hit : null);
            }
        }

        mode = Mode.None;
    }

    void SendManipulator(string phase, float rnX, float rnY, float dx = 0f, float dy = 0f)
    {
        if (manipulator == null) return;
        manipulator.ApplyGestureFromRn(JsonUtility.ToJson(new FurnitureGestureRnPayload
        {
            phase = phase,
            x = rnX,
            y = rnY,
            dx = dx,
            dy = dy,
        }));
    }

    bool TryPickForRotate(Vector2 a, Vector2 b, Vector2 mid, out PlacedFurniture target)
    {
        target = null;
        if (placement == null) return false;

        var pad = PadPx(RotatePadInches);
        var selected = placement.Selected;
        if (selected != null
            && (IsOnInstance(selected, mid, pad) || IsOnInstance(selected, a, pad) || IsOnInstance(selected, b, pad)))
        {
            target = selected;
            return true;
        }

        return TryPickFurniture(mid, pad, out target)
               || TryPickFurniture(a, pad, out target)
               || TryPickFurniture(b, pad, out target);
    }

    bool TryPickFurniture(Vector2 unityScreen, float padPx, out PlacedFurniture hit)
    {
        hit = null;
        if (placement == null) return false;
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null) return false;

        var ray = arCamera.ScreenPointToRay(unityScreen);
        var hits3d = Physics.RaycastAll(ray, 80f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
        if (hits3d != null && hits3d.Length > 0)
        {
            Array.Sort(hits3d, (x, y) => x.distance.CompareTo(y.distance));
            foreach (var physicsHit in hits3d)
            {
                hit = physicsHit.transform.GetComponentInParent<PlacedFurniture>();
                if (hit != null) return true;
            }
        }

        // Colliders can be missing on freshly loaded GLBs — fall back to the on-screen footprint.
        var bestDist = float.MaxValue;
        foreach (var instance in placement.Instances)
        {
            if (instance == null) continue;
            if (!TryGetScreenRect(instance, out var rect)) continue;
            if (!Expand(rect, padPx).Contains(unityScreen)) continue;
            var d = Vector2.Distance(unityScreen, rect.center);
            if (d < bestDist)
            {
                bestDist = d;
                hit = instance;
            }
        }

        return hit != null;
    }

    bool IsOnInstance(PlacedFurniture instance, Vector2 unityScreen, float padPx)
    {
        return TryGetScreenRect(instance, out var rect) && Expand(rect, padPx).Contains(unityScreen);
    }

    bool TryGetScreenRect(PlacedFurniture instance, out Rect rect)
    {
        rect = default;
        if (instance == null) return false;
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null) return false;

        var renderers = instance.GetComponentsInChildren<Renderer>();
        var hasBounds = false;
        var bounds = new Bounds(instance.transform.position, Vector3.zero);
        foreach (var r in renderers)
        {
            if (r == null || !r.enabled || r is LineRenderer) continue;
            if (!hasBounds)
            {
                bounds = r.bounds;
                hasBounds = true;
            }
            else
            {
                bounds.Encapsulate(r.bounds);
            }
        }

        var min = new Vector2(float.MaxValue, float.MaxValue);
        var max = new Vector2(float.MinValue, float.MinValue);
        var anyInFront = false;
        for (var i = 0; i < 8; i++)
        {
            var corner = new Vector3(
                (i & 1) == 0 ? bounds.min.x : bounds.max.x,
                (i & 2) == 0 ? bounds.min.y : bounds.max.y,
                (i & 4) == 0 ? bounds.min.z : bounds.max.z);
            var sp = arCamera.WorldToScreenPoint(corner);
            if (sp.z < 0.05f) continue;
            anyInFront = true;
            min = Vector2.Min(min, sp);
            max = Vector2.Max(max, sp);
        }

        if (!anyInFront) return false;
        rect = Rect.MinMaxRect(min.x, min.y, max.x, max.y);
        return true;
    }

    static Rect Expand(Rect rect, float pad)
        => Rect.MinMaxRect(rect.xMin - pad, rect.yMin - pad, rect.xMax + pad, rect.yMax + pad);

    static float PadPx(float inches)
    {
        var dpi = Screen.dpi > 1f ? Screen.dpi : 400f;
        return dpi * inches;
    }

    static Vector2 RnToUnityScreen(float pageX, float pageY)
        => new(pageX, Screen.height - pageY);

    static Vector2 UnityToRnScreen(Vector2 unityScreen)
        => new(unityScreen.x, Screen.height - unityScreen.y);

    [Serializable]
    class PlannerPointerRnPayload
    {
        public string phase;
        public float x;
        public float y;
        public float x2;
        public float y2;
        public float dx;
        public float dy;
        public float pinch = 1f;
        public float twistDelta;
        public int fingers = 1;
    }

    [Serializable]
    class FurnitureGestureRnPayload
    {
        public string phase;
        public float x;
        public float y;
        public float dx;
        public float dy;
        public float twistDelta;
    }

    [Serializable]
    class OrbitPayload
    {
        public float dx;
        public float dy;
        public float pinch = 1f;
    }
}
