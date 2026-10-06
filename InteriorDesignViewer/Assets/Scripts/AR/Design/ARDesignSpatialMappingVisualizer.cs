using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Simple world-space markers for mapped openings and existing furniture during scan.
/// </summary>
public class ARDesignSpatialMappingVisualizer : MonoBehaviour
{
    [SerializeField] private Color doorColor = new(0.2f, 0.55f, 0.95f, 0.85f);
    [SerializeField] private Color windowColor = new(0.95f, 0.85f, 0.2f, 0.85f);
    [SerializeField] private Color obstacleColor = new(0.55f, 0.35f, 0.2f, 0.55f);
    [SerializeField] private Color suggestionColor = new(1f, 0.55f, 0.12f, 0.45f);
    [SerializeField] private Color edgeMarkerColor = new(1f, 1f, 1f, 0.95f);

    Transform root;
    readonly List<GameObject> spawned = new();

    void Awake()
    {
        root = new GameObject("SpatialMappingVisuals").transform;
        root.SetParent(transform, false);
    }

    public void Rebuild(
        IReadOnlyList<Vector3> corners,
        float wallHeight,
        IReadOnlyList<RoomOpeningPayload> openings,
        IReadOnlyList<RoomObstaclePayload> obstacles,
        IReadOnlyList<FurnitureAutoSuggestion> suggestions,
        Vector3? pendingOpeningEdge,
        ARDesignSpatialMappingController.Phase phase)
    {
        Clear();
        if (corners == null || corners.Count < 3) return;
        if (phase == ARDesignSpatialMappingController.Phase.Outline) return;

        if (pendingOpeningEdge.HasValue)
            SpawnEdgeMarker(pendingOpeningEdge.Value, wallHeight);

        if (openings != null)
        {
            foreach (var opening in openings)
                SpawnOpening(corners, wallHeight, opening);
        }

        if (suggestions != null && phase == ARDesignSpatialMappingController.Phase.ExistingFurniture)
        {
            foreach (var suggestion in suggestions)
                SpawnSuggestion(suggestion);
        }

        if (obstacles != null)
        {
            foreach (var obstacle in obstacles)
                SpawnObstacle(obstacle);
        }
    }

    void SpawnOpening(IReadOnlyList<Vector3> corners, float wallHeight, RoomOpeningPayload opening)
    {
        var i = opening.wallIndex;
        if (i < 0 || i >= corners.Count) return;
        var a = corners[i];
        var b = corners[(i + 1) % corners.Count];
        var ab = b - a;
        ab.y = 0f;
        var len = ab.magnitude;
        if (len < 1e-3f) return;
        var dir = ab / len;
        var start = a + dir * opening.offsetAlongWall;
        var end = start + dir * opening.width;
        var floorY = Mathf.Min(a.y, b.y);
        var sill = opening.sillHeight;
        var mid = (start + end) * 0.5f;
        mid.y = floorY + sill + opening.height * 0.5f;

        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = opening.type + "_" + opening.id;
        go.transform.SetParent(root, false);
        go.transform.position = mid;
        go.transform.rotation = Quaternion.LookRotation(dir, Vector3.up);
        go.transform.localScale = new Vector3(opening.width, opening.height, 0.06f);
        Destroy(go.GetComponent<Collider>());
        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = CreateUnlit(opening.type == "door" ? doorColor : windowColor);
        spawned.Add(go);
    }

    void SpawnEdgeMarker(Vector3 point, float wallHeight)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        go.name = "opening_edge";
        go.transform.SetParent(root, false);
        var height = Mathf.Min(2.1f, wallHeight);
        go.transform.position = point + Vector3.up * (height * 0.5f);
        go.transform.localScale = new Vector3(0.04f, height * 0.5f, 0.04f);
        Destroy(go.GetComponent<Collider>());
        go.GetComponent<MeshRenderer>().sharedMaterial = CreateUnlit(edgeMarkerColor);
        spawned.Add(go);
    }

    void SpawnSuggestion(FurnitureAutoSuggestion suggestion)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = "suggest_" + suggestion.id;
        go.transform.SetParent(root, false);
        go.transform.position = new Vector3(
            suggestion.center.x,
            suggestion.center.y + suggestion.size.y * 0.5f,
            suggestion.center.z);
        go.transform.rotation = Quaternion.Euler(0f, suggestion.yaw, 0f);
        go.transform.localScale = new Vector3(suggestion.size.x, suggestion.size.y, suggestion.size.z);
        Destroy(go.GetComponent<Collider>());
        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = CreateUnlit(suggestionColor);
        spawned.Add(go);
    }

    void SpawnObstacle(RoomObstaclePayload obstacle)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = "obstacle_" + obstacle.id;
        go.transform.SetParent(root, false);
        go.transform.position = new Vector3(obstacle.center.x, obstacle.center.y + obstacle.size.y * 0.5f, obstacle.center.z);
        go.transform.rotation = Quaternion.Euler(0f, obstacle.yaw, 0f);
        go.transform.localScale = new Vector3(obstacle.size.x, obstacle.size.y, obstacle.size.z);
        Destroy(go.GetComponent<Collider>());
        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = CreateUnlit(obstacleColor);
        spawned.Add(go);
    }

    static Material CreateUnlit(Color color) => ARLineMaterialUtil.CreateTransparent(color);

    void Clear()
    {
        for (var i = 0; i < spawned.Count; i++)
        {
            if (spawned[i] != null)
                Destroy(spawned[i]);
        }

        spawned.Clear();
    }

    void OnDestroy() => Clear();
}
