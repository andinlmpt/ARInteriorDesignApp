using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// How the scan's floor plan sits in the mini map. Points are on the floor plan
/// (x = world x, y = world z). The map is turned once (so it doesn't spin while the user walks)
/// and its scale and centre ease toward fitting everything, except that it zooms out at once when
/// something would fall off the edge. No AR or UI types, so it can be checked off the phone.
/// </summary>
public sealed class ScanMapFrame
{
    const float QuarterTurn = Mathf.PI * 0.5f;

    bool hasFit;

    /// <summary>Turn applied to the floor plan (radians, counter-clockwise).</summary>
    public float Angle { get; private set; }
    /// <summary>Middle of the map, in turned floor-plan metres.</summary>
    public Vector2 Center { get; private set; }
    /// <summary>Map units per metre.</summary>
    public float Scale { get; private set; } = 1f;

    public void Reset()
    {
        hasFit = false;
        Angle = 0f;
        Center = Vector2.zero;
        Scale = 1f;
    }

    /// <summary>Turns the map so <paramref name="forward"/> points up (the way the user faced when the step began).</summary>
    public void FaceUp(Vector2 forward)
    {
        if (forward.sqrMagnitude < 1e-6f) return;
        Angle = QuarterTurn - Mathf.Atan2(forward.y, forward.x);
        hasFit = false;
    }

    /// <summary>Turns the map by the least amount that lines <paramref name="wallDirection"/> up with the map's edges.</summary>
    public void SquareTo(Vector2 wallDirection)
    {
        if (wallDirection.sqrMagnitude < 1e-6f) return;
        var turned = Turn(wallDirection);
        var angle = Mathf.Atan2(turned.y, turned.x);
        var snapped = Mathf.Round(angle / QuarterTurn) * QuarterTurn;
        if (Mathf.Abs(snapped - angle) < 1e-4f) return;
        Angle += snapped - angle;
        hasFit = false;
    }

    public Vector2 Turn(Vector2 p)
    {
        var c = Mathf.Cos(Angle);
        var s = Mathf.Sin(Angle);
        return new Vector2(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    /// <summary>Map position of a floor-plan point, with (0, 0) at the middle of the map.</summary>
    public Vector2 Project(Vector2 p) => (Turn(p) - Center) * Scale;

    /// <summary>A floor-plan direction as a map direction (not scaled).</summary>
    public Vector2 ProjectDirection(Vector2 d) => Turn(d);

    /// <summary>
    /// Fits <paramref name="points"/> into a square map <paramref name="mapSize"/> units wide,
    /// <paramref name="padding"/> in from the edges, showing at least <paramref name="minSpan"/> metres.
    /// <paramref name="ease"/> is how far (0–1) to move toward the new fit; 1 jumps there.
    /// </summary>
    public void Fit(IReadOnlyList<Vector2> points, float mapSize, float padding, float minSpan, float ease)
    {
        if (points == null || points.Count == 0) return;

        var min = new Vector2(float.MaxValue, float.MaxValue);
        var max = new Vector2(float.MinValue, float.MinValue);
        foreach (var p in points)
        {
            var t = Turn(p);
            min = Vector2.Min(min, t);
            max = Vector2.Max(max, t);
        }

        var usable = Mathf.Max(1f, mapSize - 2f * padding);
        var span = Mathf.Max(max.x - min.x, max.y - min.y, minSpan);
        var targetScale = usable / span;
        var targetCenter = (min + max) * 0.5f;

        if (!hasFit || ease >= 1f)
        {
            Scale = targetScale;
            Center = targetCenter;
            hasFit = true;
            return;
        }

        var k = Mathf.Clamp01(ease);
        var scale = Mathf.Lerp(Scale, targetScale, k);
        var center = Vector2.Lerp(Center, targetCenter, k);

        // Easing must never leave something outside the map: then jump to the new fit.
        var half = mapSize * 0.5f;
        var fits = (min - center).x * scale >= -half && (min - center).y * scale >= -half
                   && (max - center).x * scale <= half && (max - center).y * scale <= half;
        Scale = fits ? scale : targetScale;
        Center = fits ? center : targetCenter;
    }
}
