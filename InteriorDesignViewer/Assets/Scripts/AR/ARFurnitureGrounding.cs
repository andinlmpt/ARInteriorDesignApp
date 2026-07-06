using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Grounding helpers: accurate floor contact and blob shadows.
/// </summary>
public static class ARFurnitureGrounding
{
    const string BlobShadowName = "BlobShadow";

    public static void AlignToFloor(GameObject furniture, float floorY, float contactInset = 0.02f)
    {
        if (furniture == null)
        {
            return;
        }

        var contactY = GetSupportContactY(furniture);
        if (float.IsPositiveInfinity(contactY))
        {
            return;
        }

        var targetY = floorY - contactInset;
        var offset = targetY - contactY;

        if (Mathf.Abs(offset) > 2f)
        {
            Debug.LogWarning($"[ARFurnitureGrounding] Skipping large align offset ({offset:F2}m).");
            return;
        }

        furniture.transform.position += Vector3.up * offset;
    }

    /// <summary>
    /// Estimates the support contact height, ignoring outlier geometry below the real feet.
    /// </summary>
    public static float GetSupportContactY(GameObject root)
    {
        var minYs = new List<float>();
        var renderers = root.GetComponentsInChildren<Renderer>();
        if (renderers == null)
        {
            return float.PositiveInfinity;
        }

        foreach (var renderer in renderers)
        {
            if (!renderer.enabled || IsBlobShadow(renderer))
            {
                continue;
            }

            minYs.Add(renderer.bounds.min.y);
        }

        if (minYs.Count == 0)
        {
            return float.PositiveInfinity;
        }

        minYs.Sort();

        if (minYs.Count == 1)
        {
            return minYs[0];
        }

        // Ignore a single mesh corner far below the rest (common on imported furniture).
        if (minYs[1] - minYs[0] > 0.12f)
        {
            return minYs[1];
        }

        return minYs[0];
    }

    public static void AttachBlobShadow(
        GameObject furniture,
        Transform shadowParent,
        GameObject blobShadowPrefab,
        float scaleMultiplier = 0.55f)
    {
        if (furniture == null || blobShadowPrefab == null)
        {
            return;
        }

        ClearBlobShadows(shadowParent);

        if (!TryGetFootprint(furniture, out var center, out var lowestY, out var footprintSize))
        {
            return;
        }

        var parent = shadowParent != null ? shadowParent : furniture.transform;
        var shadow = Object.Instantiate(blobShadowPrefab, parent);
        shadow.name = BlobShadowName;

        shadow.transform.position = new Vector3(center.x, lowestY + 0.001f, center.z);
        shadow.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        shadow.transform.localScale = Vector3.one * footprintSize * scaleMultiplier;
    }

    public static void ClearBlobShadows(Transform shadowParent)
    {
        if (shadowParent == null)
        {
            return;
        }

        for (var i = shadowParent.childCount - 1; i >= 0; i--)
        {
            var child = shadowParent.GetChild(i);
            if (child.name == BlobShadowName)
            {
                Object.Destroy(child.gameObject);
            }
        }
    }

    public static bool TryGetFootprint(GameObject root, out Vector3 center, out float lowestY, out float footprintSize)
    {
        center = default;
        lowestY = float.PositiveInfinity;
        footprintSize = 0f;

        if (!TryGetFurnitureBounds(root, out var bounds))
        {
            return false;
        }

        lowestY = GetSupportContactY(root);
        center = new Vector3(bounds.center.x, lowestY, bounds.center.z);
        footprintSize = Mathf.Max(bounds.size.x, bounds.size.z);
        return true;
    }

    public static float GetLowestWorldY(GameObject root)
    {
        return GetSupportContactY(root);
    }

    public static bool TryGetFurnitureBounds(GameObject root, out Bounds bounds)
    {
        bounds = default;
        var renderers = root.GetComponentsInChildren<Renderer>();
        if (renderers == null || renderers.Length == 0)
        {
            return false;
        }

        var found = false;
        foreach (var renderer in renderers)
        {
            if (!renderer.enabled || IsBlobShadow(renderer))
            {
                continue;
            }

            if (!found)
            {
                bounds = renderer.bounds;
                found = true;
            }
            else
            {
                bounds.Encapsulate(renderer.bounds);
            }
        }

        return found;
    }

    static bool IsBlobShadow(Renderer renderer)
    {
        return renderer != null && renderer.gameObject.name == BlobShadowName;
    }
}
