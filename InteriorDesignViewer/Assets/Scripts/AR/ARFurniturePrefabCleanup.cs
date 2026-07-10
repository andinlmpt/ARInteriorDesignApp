using UnityEngine;

/// <summary>
/// Strips non-furniture geometry from imported AR prefabs (flat base discs, shadow planes).
/// </summary>
public static class ARFurniturePrefabCleanup
{
    static readonly string[] HiddenChildNames = { "Cube.003", "BlobShadow", "Shadow", "BaseDisc" };

    public static void HideEmbeddedBaseMeshes(GameObject furnitureRoot)
    {
        if (furnitureRoot == null) return;

        foreach (var t in furnitureRoot.GetComponentsInChildren<Transform>(true))
        {
            if (t == null || t == furnitureRoot.transform) continue;

            foreach (var name in HiddenChildNames)
            {
                if (!t.name.Contains(name)) continue;
                t.gameObject.SetActive(false);
                break;
            }
        }
    }
}
