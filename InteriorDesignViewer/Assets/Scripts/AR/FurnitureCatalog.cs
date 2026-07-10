using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class FurnitureEntry
{
    public string     id;
    public string     displayName;
    public GameObject prefab;
    public Sprite     icon;
}

/// <summary>
/// Registry of spawnable furniture prefabs. Used by UnityMessageBridge and ARFurniturePickerUI.
/// </summary>
public class FurnitureCatalog : MonoBehaviour
{
    [SerializeField] private List<FurnitureEntry> entries = new();
    [SerializeField] private GameObject           defaultPrefab;

    public IReadOnlyList<FurnitureEntry> Entries => entries;

    public GameObject GetPrefab(string id)
    {
        var entry = GetEntry(id);
        return entry != null ? entry.prefab : defaultPrefab;
    }

    public FurnitureEntry GetEntry(string id)
    {
        if (string.IsNullOrEmpty(id))
            return null;

        foreach (var entry in entries)
        {
            if (entry.id == id && entry.prefab != null)
                return entry;
        }

        return null;
    }

    public FurnitureEntry GetEntryForPrefab(GameObject prefab)
    {
        if (prefab == null)
            return null;

        foreach (var entry in entries)
        {
            if (entry.prefab == prefab)
                return entry;
        }

        return null;
    }

    public string GetDisplayName(FurnitureEntry entry)
    {
        if (entry == null)
            return string.Empty;

        if (!string.IsNullOrWhiteSpace(entry.displayName))
            return entry.displayName;

        if (entry.prefab != null)
            return entry.prefab.name;

        return entry.id;
    }
}
