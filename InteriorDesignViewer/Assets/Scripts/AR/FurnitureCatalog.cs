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

    [Tooltip("Remote GLB URL from MongoDB/GCS. When set, placement loads this instead of a bundled prefab.")]
    public string glbUrl;

    [Tooltip("Optional thumbnail URL for the catalog UI.")]
    public string thumbnailUrl;

    [Tooltip("Exact reference label from the product sheet, e.g. L 90\" × W 32\" × H 32\".")]
    public string dimensionLabel;
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

    [Header("Catalog source")]
    [Tooltip("When enabled, bundled scene prefabs are ignored. Metadata comes from FurnitureDimensions.json; GLB URLs come from MongoDB/GCS via RemoteFurnitureCatalogLoader.")]
    [SerializeField] private bool remoteCatalogOnly = true;

    public IReadOnlyList<FurnitureEntry> Entries => entries;
    public bool RemoteCatalogOnly => remoteCatalogOnly;

    void Awake()
    {
        if (remoteCatalogOnly)
            entries.Clear();

        EnsureBundledResourceEntries();
        ApplyBundledDimensionLabels();
    }

    public void ClearEntries()
    {
        entries.Clear();
    }

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

        // Remote catalog: always stream GLBs from GCS — never pull bundled prefabs into memory.
        if (remoteCatalogOnly && !string.IsNullOrWhiteSpace(entry.glbUrl))
            return null;

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

    public string GetGlbUrl(string id)
    {
        var entry = GetEntry(id);
        return entry != null ? entry.glbUrl : null;
    }

    public string GetDimensionLabel(string id)
    {
        var entry = GetEntry(id);
        return entry != null ? entry.dimensionLabel : null;
    }

    /// <summary>Catalog width (x), height (y), depth (z) in metres.</summary>
    public Vector3 GetCatalogDimensions(string id)
    {
        return GetDefaultDimensions(id);
    }

    /// <summary>
    /// Merges remote catalog items from the backend. Existing ids are updated in place.
    /// </summary>
    public void MergeRemoteEntries(IEnumerable<FurnitureEntry> remoteEntries)
    {
        if (remoteEntries == null) return;

        foreach (var remote in remoteEntries)
        {
            if (remote == null || string.IsNullOrWhiteSpace(remote.id))
                continue;

            var existing = GetEntry(remote.id);
            if (existing != null)
            {
                existing.displayName = string.IsNullOrWhiteSpace(remote.displayName) ? existing.displayName : remote.displayName;
                existing.category = string.IsNullOrWhiteSpace(remote.category) ? existing.category : remote.category;
                existing.glbUrl = remote.glbUrl;
                existing.thumbnailUrl = remote.thumbnailUrl;
                existing.dimensionLabel = remote.dimensionLabel;
                if (remote.width > 0.01f) existing.width = remote.width;
                if (remote.height > 0.01f) existing.height = remote.height;
                if (remote.depth > 0.01f) existing.depth = remote.depth;
                continue;
            }

            entries.Add(new FurnitureEntry
            {
                id = remote.id,
                displayName = remote.displayName,
                category = remote.category,
                glbUrl = remote.glbUrl,
                thumbnailUrl = remote.thumbnailUrl,
                dimensionLabel = remote.dimensionLabel,
                width = remote.width > 0.01f ? remote.width : 0.6f,
                height = remote.height > 0.01f ? remote.height : 0.6f,
                depth = remote.depth > 0.01f ? remote.depth : 0.6f,
            });
        }
    }

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

    /// <summary>
    /// Registers catalog entries from bundled FurnitureDimensions.json (metadata only).
    /// Does NOT load prefabs — those stay lazy via <see cref="ResolvePrefab"/>.
    /// Loading all Resources/Furniture prefabs at once OOMs mobile devices.
    /// </summary>
    public int EnsureBundledResourceEntries()
    {
        var asset = Resources.Load<TextAsset>(DimensionDataResource);
        if (asset == null)
        {
            Debug.Log("[FurnitureCatalog] No bundled FurnitureDimensions.json — using scene entries only.");
            return 0;
        }

        FurnitureDimensionDatabase db;
        try
        {
            db = JsonUtility.FromJson<FurnitureDimensionDatabase>(asset.text);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[FurnitureCatalog] Failed to parse {DimensionDataResource}: {e.Message}");
            return 0;
        }

        if (db?.furniture == null || db.furniture.Length == 0)
            return 0;

        var added = 0;
        foreach (var record in db.furniture)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.id))
                continue;

            var id = record.id.Trim().ToLowerInvariant();
            if (GetEntry(id) != null)
                continue;

            var displayName = !string.IsNullOrWhiteSpace(record.displayName)
                ? record.displayName.Trim()
                : HumanizeId(id);

            entries.Add(new FurnitureEntry
            {
                id = id,
                displayName = displayName,
                category = InferCategory(id, displayName),
                resourcePath = $"{DefaultResourceFolder}/{id}",
                dimensionLabel = record.label ?? string.Empty,
                width = record.width > 0.01f ? record.width : 0.6f,
                height = record.height > 0.01f ? record.height : 0.6f,
                depth = record.length > 0.01f ? record.length : 0.6f,
            });
            added++;
        }

        if (added > 0)
            Debug.Log($"[FurnitureCatalog] Registered {added} bundled catalog entries (total {entries.Count}, prefabs lazy-loaded).");

        return added;
    }

    const string DimensionDataResource = "FurnitureDimensions";

    void ApplyBundledDimensionLabels()
    {
        var asset = Resources.Load<TextAsset>(DimensionDataResource);
        if (asset == null)
        {
            Debug.Log("[FurnitureCatalog] No bundled FurnitureDimensions.json — inch labels will be derived from catalog metres.");
            return;
        }

        FurnitureDimensionDatabase db;
        try
        {
            db = JsonUtility.FromJson<FurnitureDimensionDatabase>(asset.text);
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[FurnitureCatalog] Failed to parse {DimensionDataResource}: {e.Message}");
            return;
        }

        if (db?.furniture == null || db.furniture.Length == 0)
            return;

        var applied = 0;
        foreach (var record in db.furniture)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.id))
                continue;

            var entry = GetEntry(record.id.Trim().ToLowerInvariant());
            if (entry == null)
                continue;

            if (!string.IsNullOrWhiteSpace(record.label))
                entry.dimensionLabel = record.label.Trim();

            if (record.width > 0.01f) entry.width = record.width;
            if (record.height > 0.01f) entry.height = record.height;
            if (record.length > 0.01f) entry.depth = record.length;

            applied++;
        }

        Debug.Log($"[FurnitureCatalog] Applied bundled dimension labels to {applied} items.");
    }

    static string HumanizeId(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return id;
        var words = id.Replace('-', ' ').Replace('_', ' ').Split(' ');
        for (var i = 0; i < words.Length; i++)
        {
            if (words[i].Length == 0) continue;
            words[i] = char.ToUpperInvariant(words[i][0]) + words[i].Substring(1);
        }
        return string.Join(" ", words);
    }
}

[System.Serializable]
public class FurnitureDimensionRecord
{
    public string id;
    public string displayName;
    public string label;
    public float width;
    public float height;
    public float length;
    public int lengthIn;
    public int widthIn;
    public int heightIn;
}

[System.Serializable]
public class FurnitureDimensionDatabase
{
    public FurnitureDimensionRecord[] furniture;
}
