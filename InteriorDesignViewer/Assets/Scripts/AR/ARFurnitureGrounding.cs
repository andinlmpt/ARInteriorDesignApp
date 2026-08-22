using UnityEngine;

/// <summary>
/// Grounding helpers: accurate floor contact and blob shadows.
/// </summary>
public static class ARFurnitureGrounding
{
    const string BlobShadowName = "BlobShadow";

    public static void AlignToFloor(GameObject furniture, float floorY, float contactInset = 0.02f)
    {
        if (furniture == null) return;

        Physics.SyncTransforms();
        var contactY = GetSupportContactY(furniture);
        if (float.IsPositiveInfinity(contactY)) return;

        var targetY = floorY - contactInset;
        var offset  = targetY - contactY;

        if (Mathf.Abs(offset) > 5f)
        {
            Debug.LogWarning($"[ARFurnitureGrounding] Skipping large align offset ({offset:F2}m).");
            return;
        }

        furniture.transform.position += Vector3.up * offset;
    }

    /// <summary>
    /// Places furniture at floorPoint XZ and iteratively snaps mesh feet to floor Y.
    /// Works for imported models whose pivot is not at the legs.
    /// </summary>
    const float MaxFootCorrectionPerStep = 2.5f;
    const float MaxPivotAboveFoot        = 4f;

    /// <summary>
    /// One-shot snap using the model's local-space lowest Y (not a world AABB).
    /// World AABBs grow when the sofa is yawed and make feet look like they float.
    /// </summary>
    public static bool SnapLocalFootToFloor(
        Transform furniture,
        float localFootY,
        Vector3 floorPoint,
        float contactInset = 0.01f)
    {
        if (furniture == null) return false;

        var scaleY = Mathf.Abs(furniture.lossyScale.y);
        if (scaleY < 1e-5f) scaleY = 1f;

        var targetPivotY = floorPoint.y - contactInset - localFootY * scaleY;
        furniture.position = new Vector3(floorPoint.x, targetPivotY, floorPoint.z);
        return true;
    }

    /// <summary>
    /// One-shot snap: keep XZ at floorPoint, raise pivot so mesh feet touch floor Y.
    /// Returns false when renderer bounds are not ready yet.
    /// </summary>
    public static bool SnapPivotToFloorPoint(GameObject furniture, Vector3 floorPoint, float contactInset = 0.02f)
    {
        if (furniture == null) return false;

        Physics.SyncTransforms();
        var pivotY = furniture.transform.position.y;
        var footY  = GetSupportContactY(furniture);
        if (!IsValidPivotToFoot(pivotY, footY)) return false;

        var pivotAboveFoot = pivotY - footY;
        var targetPivotY   = floorPoint.y - contactInset + pivotAboveFoot;
        furniture.transform.position = new Vector3(floorPoint.x, targetPivotY, floorPoint.z);
        return true;
    }

    public static void PlaceFeetOnFloor(GameObject furniture, Vector3 floorPoint, float contactInset = 0.02f, int iterations = 16)
    {
        if (furniture == null) return;

        if (SnapPivotToFloorPoint(furniture, floorPoint, contactInset))
            return;

        var targetFootY = floorPoint.y - contactInset;
        var pos         = furniture.transform.position;
        furniture.transform.position = new Vector3(floorPoint.x, pos.y, floorPoint.z);

        for (var i = 0; i < iterations; i++)
        {
            Physics.SyncTransforms();
            var footY = GetSupportContactY(furniture);
            if (float.IsPositiveInfinity(footY)) continue;

            var correction = targetFootY - footY;
            if (Mathf.Abs(correction) < 0.0005f) break;
            if (Mathf.Abs(correction) > MaxFootCorrectionPerStep)
            {
                Debug.LogWarning($"[ARFurnitureGrounding] Skipping unsafe foot correction ({correction:F2}m).");
                break;
            }

            furniture.transform.position += Vector3.up * correction;
        }
    }

    public static bool TryAlignToFloorWhenReady(GameObject furniture, float floorY, float contactInset = 0.02f)
    {
        if (furniture == null) return false;

        Physics.SyncTransforms();
        var contactY = GetSupportContactY(furniture);
        if (float.IsPositiveInfinity(contactY)) return false;

        AlignToFloor(furniture, floorY, contactInset);
        return true;
    }

    public static void PlaceAtFloorPoint(GameObject furniture, Vector3 floorPoint, float contactInset = 0.02f)
    {
        PlaceFeetOnFloor(furniture, floorPoint, contactInset);
    }

    /// <summary>
    /// Lowest world Y of furniture geometry (mesh corners + renderer/collider bounds).
    /// </summary>
    public static float GetSupportContactY(GameObject root)
    {
        var lowest = float.PositiveInfinity;

        foreach (var meshFilter in root.GetComponentsInChildren<MeshFilter>())
        {
            if (meshFilter == null || meshFilter.sharedMesh == null) continue;
            if (!meshFilter.gameObject.activeInHierarchy) continue;
            if (IsIgnoredForGrounding(meshFilter.gameObject)) continue;
            if (!HasValidBounds(meshFilter.sharedMesh.bounds)) continue;
            lowest = Mathf.Min(lowest, GetLowestWorldY(meshFilter.sharedMesh.bounds, meshFilter.transform));
        }

        foreach (var skinned in root.GetComponentsInChildren<SkinnedMeshRenderer>())
        {
            if (skinned == null || skinned.sharedMesh == null) continue;
            if (!skinned.gameObject.activeInHierarchy) continue;
            if (IsIgnoredForGrounding(skinned.gameObject)) continue;
            lowest = Mathf.Min(lowest, GetLowestWorldY(skinned.localBounds, skinned.transform));
        }

        foreach (var renderer in root.GetComponentsInChildren<Renderer>())
        {
            if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy) continue;
            if (IsBlobShadow(renderer) || IsIgnoredForGrounding(renderer.gameObject)) continue;
            if (!HasValidBounds(renderer.bounds)) continue;
            lowest = Mathf.Min(lowest, renderer.bounds.min.y);
        }

        return lowest;
    }

    static float GetLowestWorldY(Bounds localBounds, Transform t)
    {
        var center   = localBounds.center;
        var extents  = localBounds.extents;
        var lowestY  = float.PositiveInfinity;

        for (var xi = -1; xi <= 1; xi += 2)
        for (var yi = -1; yi <= 1; yi += 2)
        for (var zi = -1; zi <= 1; zi += 2)
        {
            var localCorner = center + Vector3.Scale(extents, new Vector3(xi, yi, zi));
            var worldY      = t.TransformPoint(localCorner).y;
            if (worldY < lowestY) lowestY = worldY;
        }

        return lowestY;
    }

    public static void AttachBlobShadow(
        GameObject furniture,
        Transform shadowParent,
        GameObject blobShadowPrefab,
        float scaleMultiplier = 0.55f)
    {
        if (furniture == null || blobShadowPrefab == null) return;

        ClearBlobShadows(shadowParent);

        if (!TryGetFootprint(furniture, out var center, out var lowestY, out var footprintSize))
            return;

        var parent = shadowParent != null ? shadowParent : furniture.transform;
        var shadow = Object.Instantiate(blobShadowPrefab, parent);
        shadow.name = BlobShadowName;

        shadow.transform.position = new Vector3(center.x, lowestY + 0.001f, center.z);
        shadow.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        shadow.transform.localScale = Vector3.one * footprintSize * scaleMultiplier;
    }

    public static void ClearBlobShadows(Transform shadowParent)
    {
        if (shadowParent == null) return;

        for (var i = shadowParent.childCount - 1; i >= 0; i--)
        {
            var child = shadowParent.GetChild(i);
            if (child.name == BlobShadowName)
                Object.Destroy(child.gameObject);
        }
    }

    public static bool TryGetFootprint(GameObject root, out Vector3 center, out float lowestY, out float footprintSize)
    {
        center = default;
        lowestY = float.PositiveInfinity;
        footprintSize = 0f;

        if (!TryGetFurnitureBounds(root, out var bounds))
            return false;

        lowestY = GetSupportContactY(root);
        center = new Vector3(bounds.center.x, lowestY, bounds.center.z);
        footprintSize = Mathf.Max(bounds.size.x, bounds.size.z);
        return true;
    }

    public static float GetLowestWorldY(GameObject root) => GetSupportContactY(root);

    public static bool TryGetFurnitureBounds(GameObject root, out Bounds bounds)
    {
        bounds = default;
        var renderers = root.GetComponentsInChildren<Renderer>();
        if (renderers == null || renderers.Length == 0) return false;

        var found = false;
        foreach (var renderer in renderers)
        {
            if (!renderer.enabled || IsBlobShadow(renderer)) continue;

            if (!found)
            {
                bounds = renderer.bounds;
                found  = true;
            }
            else
            {
                bounds.Encapsulate(renderer.bounds);
            }
        }

        return found;
    }

    public static bool TryGetLocalFurnitureBounds(GameObject root, out Bounds localBounds)
    {
        localBounds = new Bounds(Vector3.zero, Vector3.zero);
        var renderers = root.GetComponentsInChildren<Renderer>();
        if (renderers == null || renderers.Length == 0) return false;

        var found = false;
        var rootMatrixInv = root.transform.worldToLocalMatrix;

        foreach (var r in renderers)
        {
            if (r == null || !r.enabled || IsBlobShadow(r) || IsIgnoredForGrounding(r.gameObject)) continue;

            Bounds rendererLocalBounds;
            if (r is MeshRenderer && r.TryGetComponent<MeshFilter>(out var filter) && filter.sharedMesh != null)
            {
                rendererLocalBounds = filter.sharedMesh.bounds;
            }
            else if (r is SkinnedMeshRenderer smr && smr.sharedMesh != null)
            {
                rendererLocalBounds = smr.localBounds;
            }
            else
            {
                var worldB = r.bounds;
                var localCenter = rootMatrixInv.MultiplyPoint3x4(worldB.center);
                var localExtents = rootMatrixInv.MultiplyVector(worldB.extents);
                rendererLocalBounds = new Bounds(localCenter, localExtents * 2f);
            }

            var toRootMatrix = rootMatrixInv * r.transform.localToWorldMatrix;
            var center = rendererLocalBounds.center;
            var extents = rendererLocalBounds.extents;

            Vector3[] corners = new Vector3[8];
            corners[0] = center + new Vector3(extents.x, extents.y, extents.z);
            corners[1] = center + new Vector3(extents.x, extents.y, -extents.z);
            corners[2] = center + new Vector3(extents.x, -extents.y, extents.z);
            corners[3] = center + new Vector3(extents.x, -extents.y, -extents.z);
            corners[4] = center + new Vector3(-extents.x, extents.y, extents.z);
            corners[5] = center + new Vector3(-extents.x, extents.y, -extents.z);
            corners[6] = center + new Vector3(-extents.x, -extents.y, extents.z);
            corners[7] = center + new Vector3(-extents.x, -extents.y, -extents.z);

            foreach (var corner in corners)
            {
                var rootSpaceCorner = toRootMatrix.MultiplyPoint3x4(corner);
                if (!found)
                {
                    localBounds = new Bounds(rootSpaceCorner, Vector3.zero);
                    found = true;
                }
                else
                {
                    localBounds.Encapsulate(rootSpaceCorner);
                }
            }
        }
        return found;
    }

    static bool IsIgnoredForGrounding(GameObject go)
    {
        if (go == null) return true;
        return go.name.Contains("Cube.003") || go.name.Contains("BlobShadow");
    }

    static bool IsBlobShadow(Renderer renderer)
    {
        return renderer != null && renderer.gameObject.name == BlobShadowName;
    }

    static bool HasValidBounds(Bounds bounds)
    {
        if (bounds.size.sqrMagnitude < 1e-8f) return false;
        if (bounds.size.y > 15f || bounds.extents.magnitude > 20f) return false;
        return true;
    }

    static bool IsValidPivotToFoot(float pivotY, float footY)
    {
        if (float.IsPositiveInfinity(footY)) return false;
        var pivotAboveFoot = pivotY - footY;
        return pivotAboveFoot >= -0.05f && pivotAboveFoot <= MaxPivotAboveFoot;
    }
}
