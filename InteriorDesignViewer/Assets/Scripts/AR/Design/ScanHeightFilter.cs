using UnityEngine;

/// <summary>
/// Turns raw wall-height readings (taken while aiming up at the ceiling) into what the scan shows
/// and what Finish locks. While the phone looks up the reading follows the aim both ways, so
/// aiming past the ceiling and coming back corrects it (the old peak-only reading stayed stuck on
/// the overshoot). The last ceiling-high value held steady is kept, so lowering the phone to tap
/// Finish doesn't lose it. No AR types, so it can be checked off the phone.
/// </summary>
public sealed class ScanHeightFilter
{
    /// <summary>Readings within this of the average so far count as holding still (m).</summary>
    public float steadyTolerance = 0.04f;
    /// <summary>How long a reading must hold before it is kept (s).</summary>
    public float steadySeconds = 0.4f;
    /// <summary>Only readings at least this high are kept as the held value (lower ones are mid-wall or furniture).</summary>
    public float minHeldHeight = 1.8f;

    bool running;
    float runStartedAt;
    float runSum;
    int runCount;

    public bool HasReading { get; private set; }
    /// <summary>Height to show: the current reading while aiming up, otherwise the held one.</summary>
    public float Display { get; private set; }
    /// <summary>Last ceiling-high reading held steady; 0 when there is none yet.</summary>
    public float Held { get; private set; }
    /// <summary>Highest reading seen (only a last resort for Finish).</summary>
    public float Peak { get; private set; }
    /// <summary>True while the current reading has stayed put long enough to be kept.</summary>
    public bool IsHoldingSteady { get; private set; }
    /// <summary>Seconds the current reading has stayed put while aiming up (0 when moving or lowered).</summary>
    public float SteadyFor { get; private set; }
    /// <summary>Average of the reading while it has stayed put.</summary>
    public float SteadyValue => runCount > 0 ? runSum / runCount : Display;

    public void Reset()
    {
        running = false;
        runCount = 0;
        runSum = 0f;
        HasReading = false;
        Display = 0f;
        Held = 0f;
        Peak = 0f;
        IsHoldingSteady = false;
        SteadyFor = 0f;
    }

    /// <param name="time">Seconds (any clock that only moves forward).</param>
    /// <param name="hasReading">False when nothing could be measured this frame.</param>
    /// <param name="reading">Height above the floor point (m).</param>
    /// <param name="lookingUp">The phone aims up, so the reading is meant as the ceiling.</param>
    public void Feed(float time, bool hasReading, float reading, bool lookingUp)
    {
        if (hasReading)
            Peak = Mathf.Max(Peak, reading);

        if (hasReading && lookingUp)
        {
            HasReading = true;
            Display = reading;
            if (!running || Mathf.Abs(reading - SteadyValue) > steadyTolerance)
            {
                running = true;
                runStartedAt = time;
                runSum = 0f;
                runCount = 0;
            }

            runSum += reading;
            runCount++;
            SteadyFor = time - runStartedAt;
            IsHoldingSteady = SteadyFor >= steadySeconds;
            if (IsHoldingSteady && SteadyValue >= minHeldHeight)
                Held = SteadyValue;
            return;
        }

        // Lowered (or nothing measured): keep showing the held value.
        running = false;
        IsHoldingSteady = false;
        SteadyFor = 0f;
        if (Held > 0f)
        {
            HasReading = true;
            Display = Held;
        }
        else if (hasReading)
        {
            HasReading = true;
            Display = reading;
        }
    }

    /// <summary>
    /// The height Finish locks: what is held steady right now, else the last held value, else the
    /// current reading. Below <paramref name="minReliable"/> that's a mid-wall or furniture hit,
    /// so the highest reading is tried, and then <paramref name="fallback"/>.
    /// </summary>
    public float Resolve(float minReliable, float fallback)
    {
        var candidate = IsHoldingSteady ? SteadyValue : Held > 0f ? Held : HasReading ? Display : 0f;
        if (candidate >= minReliable) return candidate;
        if (Peak >= minReliable) return Peak;
        return fallback;
    }

    /// <summary>
    /// Height above <paramref name="floorY"/> where a ray crosses a wall's plane. The wall is its
    /// line on the floor plan (x = world x, y = world z), the way it faces, and the part of it that
    /// was seen (<paramref name="tMin"/>–<paramref name="tMax"/> along the line, tangent =
    /// (−normal.y, normal.x)). Crossings more than <paramref name="alongMargin"/> past the seen
    /// part, behind the camera or further than <paramref name="maxDistance"/> don't count.
    /// </summary>
    public static bool TryWallCrossingHeight(
        Vector3 rayOrigin,
        Vector3 rayDirection,
        Vector2 wallOrigin,
        Vector2 wallNormal,
        float tMin,
        float tMax,
        float floorY,
        float alongMargin,
        float maxDistance,
        out float height)
    {
        height = 0f;
        if (wallNormal.sqrMagnitude < 1e-6f) return false;
        wallNormal.Normalize();

        // The wall is vertical, so only the floor-plan part of the ray decides where it crosses.
        var denominator = rayDirection.x * wallNormal.x + rayDirection.z * wallNormal.y;
        if (Mathf.Abs(denominator) < 1e-3f) return false;
        var toWall = new Vector2(wallOrigin.x - rayOrigin.x, wallOrigin.y - rayOrigin.z);
        var t = Vector2.Dot(toWall, wallNormal) / denominator;
        if (t <= 0.05f || t > maxDistance) return false;

        var hit = rayOrigin + rayDirection * t;
        var tangent = new Vector2(-wallNormal.y, wallNormal.x);
        var along = Vector2.Dot(new Vector2(hit.x, hit.z) - wallOrigin, tangent);
        if (along < tMin - alongMargin || along > tMax + alongMargin) return false;

        height = hit.y - floorY;
        return height > 0f;
    }
}
