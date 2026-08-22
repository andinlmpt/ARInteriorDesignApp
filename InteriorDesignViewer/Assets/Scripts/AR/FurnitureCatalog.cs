using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class FurnitureEntry
{
    public string id;
    public string displayName;
    public GameObject prefab;
    public Sprite icon;

    [Tooltip("Grouping for the IKEA-style category sidebar (e.g. seating, tables, beds).")]
    public string category = "other";

    [Tooltip("Real-world size in metres used when RN/HUD does not supply dimensions.")]
    public float width = 0.6f;
    public float height = 0.6f;
    public float depth = 0.6f;

    [Tooltip("Resources.Load path, e.g. Furniture/bahrain-accent-chair. Used so the scene does not serialize huge GLB prefabs.")]
    public string resourcePath;
}

/// <summary>
/// Registry of spawnable furniture prefabs. Used by UnityMessageBridge and catalog UI.
/// Prefabs are loaded on demand from Resources so opening ARDesignScene does not
/// pull every sofa into memory (the downloaded GLBs are 70–80 MB each).
/// </summary>
public class FurnitureCatalog : MonoBehaviour
{
    const string DefaultResourceFolder = "Furniture";
    const string IconResourceFolder = "FurnitureIcons";

    [SerializeField] private List<FurnitureEntry> entries = new();
    [SerializeField] private GameObject defaultPrefab;

    public IReadOnlyList<FurnitureEntry> Entries => entries;

    public GameObject GetPrefab(string id)
    {
        var entry = GetEntry(id);
        if (entry == null) return defaultPrefab;
        return ResolvePrefab(entry) ?? defaultPrefab;
    }

    public FurnitureEntry GetEntry(string id)
    {
        if (string.IsNullOrEmpty(id))
            return null;

        foreach (var entry in entries)
        {
            if (entry != null && entry.id == id)
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
            if (entry == null) continue;
            if (entry.prefab == prefab)
                return entry;
            if (!string.IsNullOrEmpty(entry.id) && prefab.name.StartsWith(entry.id, StringComparison.Ordinal))
                return entry;
        }

        return null;
    }

    /// <summary>
    /// Loads the prefab only when first needed. Direct scene references are
    /// optional and should stay empty so Android does not OOM after the splash.
    /// </summary>
    public GameObject ResolvePrefab(FurnitureEntry entry)
    {
        if (entry == null) return null;
        if (entry.prefab != null) return entry.prefab;

        var path = string.IsNullOrWhiteSpace(entry.resourcePath)
            ? $"{DefaultResourceFolder}/{entry.id}"
            : entry.resourcePath.Trim().TrimStart('/');

        if (string.IsNullOrEmpty(path)) return null;

        entry.prefab = Resources.Load<GameObject>(path);
        if (entry.prefab == null)
            Debug.LogWarning($"[FurnitureCatalog] Resources.Load failed for '{path}' (id={entry.id}). Run AR Interior ▸ AR Design ▸ Import Downloaded GLB Furniture.");

        return entry.prefab;
    }

    /// <summary>
    /// Catalog thumbnail. Prefers a serialized sprite, then Resources/FurnitureIcons/{id}.
    /// </summary>
    public Sprite GetIcon(FurnitureEntry entry)
    {
        if (entry == null) return null;
        if (entry.icon != null) return entry.icon;

        var path = $"{IconResourceFolder}/{entry.id}";
        var sprite = Resources.Load<Sprite>(path);
        if (sprite != null)
        {
            entry.icon = sprite;
            return sprite;
        }

        var tex = Resources.Load<Texture2D>(path);
        if (tex != null)
        {
            entry.icon = Sprite.Create(
                tex,
                new Rect(0f, 0f, tex.width, tex.height),
                new Vector2(0.5f, 0.5f),
                100f);
            return entry.icon;
        }

        return null;
    }

    public Sprite GetIcon(string id) => GetIcon(GetEntry(id));

    public Vector3 GetDefaultDimensions(string id)
    {
        var entry = GetEntry(id);
        if (entry == null)
            return new Vector3(0.6f, 0.6f, 0.6f);

        var w = entry.width > 0.01f ? entry.width : 0.6f;
        var h = entry.height > 0.01f ? entry.height : 0.6f;
        var d = entry.depth > 0.01f ? entry.depth : 0.6f;
        return new Vector3(w, h, d);
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

    public string ResolveCategory(FurnitureEntry entry)
    {
        if (entry == null) return "other";
        if (!string.IsNullOrWhiteSpace(entry.category))
            return entry.category.Trim().ToLowerInvariant();
        return InferCategory(entry.id, entry.displayName);
    }

    public static string InferCategory(string id, string displayName)
    {
        var key = $"{id} {displayName}".ToLowerInvariant();
        if (key.Contains("sofa") || key.Contains("chair") || key.Contains("bean") || key.Contains("seat") ||
            key.Contains("lounge"))
            return "seating";
        if (key.Contains("table") || key.Contains("desk") || key.Contains("console"))
            return "tables";
        if (key.Contains("bed") || key.Contains("mattress"))
            return "beds";
        if (key.Contains("lamp") || key.Contains("light"))
            return "lighting";
        if (key.Contains("wash") || key.Contains("machine") || key.Contains("appliance"))
            return "appliances";
        return "other";
    }

    public List<FurnitureEntry> GetEntriesInCategory(string category)
    {
        var list = new List<FurnitureEntry>();
        if (string.IsNullOrEmpty(category) || category == "all")
        {
            foreach (var entry in entries)
            {
                if (IsListable(entry))
                    list.Add(entry);
            }
            return list;
        }

        var want = category.Trim().ToLowerInvariant();
        foreach (var entry in entries)
        {
            if (!IsListable(entry)) continue;
            if (ResolveCategory(entry) == want)
                list.Add(entry);
        }
        return list;
    }

    static bool IsListable(FurnitureEntry entry)
    {
        return entry != null && !string.IsNullOrWhiteSpace(entry.id);
    }
}
