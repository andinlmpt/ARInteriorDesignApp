using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class FurnitureEntry
{
    public string id;
    public GameObject prefab;
}

public class FurnitureCatalog : MonoBehaviour
{
    [SerializeField] private List<FurnitureEntry> entries = new();
    [SerializeField] private GameObject defaultPrefab;

    public GameObject GetPrefab(string id)
    {
        if (!string.IsNullOrEmpty(id))
        {
            foreach (var entry in entries)
            {
                if (entry.id == id && entry.prefab != null)
                {
                    return entry.prefab;
                }
            }
        }

        return defaultPrefab;
    }
}
