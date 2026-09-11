using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Fetches the furniture catalog from the backend (MongoDB + GCS URLs) and merges
/// it into the local <see cref="FurnitureCatalog"/>.
/// </summary>
public class RemoteFurnitureCatalogLoader : MonoBehaviour
{
    [SerializeField] private FurnitureCatalog catalog;
    [SerializeField] private ARDesignFurnitureCatalogUI catalogUi;

    [Tooltip("Backend catalog endpoint, e.g. http://192.168.1.7:3000/api/v1/furniture")]
    [SerializeField] private string catalogUrl = "http://192.168.1.7:3000/api/v1/furniture";

    [SerializeField] private bool loadOnStart = true;
    [SerializeField] private float requestTimeoutSeconds = 20f;

    public bool IsLoaded { get; private set; }
    public string LastError { get; private set; }

    public event Action CatalogLoaded;

    void Awake()
    {
        if (catalog == null) catalog = FindFirstObjectByType<FurnitureCatalog>();
        if (catalogUi == null) catalogUi = FindFirstObjectByType<ARDesignFurnitureCatalogUI>();
    }

    void Start()
    {
        if (loadOnStart)
            RefreshCatalog();
    }

    public void SetCatalogUrl(string url)
    {
        if (!string.IsNullOrWhiteSpace(url))
            catalogUrl = url.Trim();
    }

    public void RefreshCatalog()
    {
        StopAllCoroutines();
        StartCoroutine(FetchCatalogCoroutine());
    }

    IEnumerator FetchCatalogCoroutine()
    {
        IsLoaded = false;
        LastError = null;

        if (catalog == null)
        {
            LastError = "FurnitureCatalog is missing.";
            Debug.LogWarning($"[RemoteFurnitureCatalogLoader] {LastError}");
            yield break;
        }

        if (string.IsNullOrWhiteSpace(catalogUrl))
        {
            LastError = "Catalog URL is empty.";
            Debug.LogWarning($"[RemoteFurnitureCatalogLoader] {LastError}");
            yield break;
        }

        using var request = UnityWebRequest.Get(catalogUrl);
        request.timeout = Mathf.Max(1, Mathf.RoundToInt(requestTimeoutSeconds));

        UnityWebRequestAsyncOperation op;
        try
        {
            op = request.SendWebRequest();
        }
        catch (InvalidOperationException e)
        {
            LastError = e.Message;
            Debug.LogError("[RemoteFurnitureCatalogLoader] HTTP blocked by Unity Player Settings. " +
                           "Set Edit → Project Settings → Player → Allow downloads over HTTP → " +
                           "Always Allowed (or Development Builds Only). " +
                           $"Details: {e.Message}");
            yield break;
        }

        yield return op;

#if UNITY_2020_2_OR_NEWER
        if (request.result != UnityWebRequest.Result.Success)
#else
        if (request.isNetworkError || request.isHttpError)
#endif
        {
            LastError = request.error;
            Debug.LogWarning($"[RemoteFurnitureCatalogLoader] Failed to fetch catalog: {request.error}");
            yield break;
        }

        RemoteFurnitureListResponse payload;
        try
        {
            payload = JsonUtility.FromJson<RemoteFurnitureListResponse>(request.downloadHandler.text);
        }
        catch (Exception e)
        {
            LastError = e.Message;
            Debug.LogWarning($"[RemoteFurnitureCatalogLoader] Invalid catalog JSON: {e.Message}");
            yield break;
        }

        if (payload?.furniture == null || payload.furniture.Count == 0)
        {
            LastError = "Catalog response contained no furniture.";
            Debug.LogWarning($"[RemoteFurnitureCatalogLoader] {LastError}");
            yield break;
        }

        var merged = new List<FurnitureEntry>();
        foreach (var item in payload.furniture)
        {
            if (item == null || string.IsNullOrWhiteSpace(item.id) || string.IsNullOrWhiteSpace(item.glbUrl))
                continue;

            merged.Add(new FurnitureEntry
            {
                id = item.id,
                displayName = item.displayName,
                category = item.category,
                glbUrl = item.glbUrl,
                thumbnailUrl = item.thumbnailUrl,
                dimensionLabel = item.dimensionLabel,
                width = item.width > 0.01f ? item.width : 0.6f,
                height = item.height > 0.01f ? item.height : 0.6f,
                depth = item.depth > 0.01f ? item.depth : 0.6f,
            });
        }

        catalog.MergeRemoteEntries(merged);
        IsLoaded = true;
        var total = catalog.Entries.Count;
        var withGlb = 0;
        foreach (var entry in catalog.Entries)
        {
            if (entry != null && !string.IsNullOrWhiteSpace(entry.glbUrl))
                withGlb++;
        }

        Debug.Log($"[RemoteFurnitureCatalogLoader] Loaded {merged.Count} remote furniture items " +
                  $"(catalog total {total}, {withGlb} with GLB URLs).");

        if (catalogUi != null)
            catalogUi.RefreshFromCatalog();
        else
            Debug.LogWarning("[RemoteFurnitureCatalogLoader] catalogUi is not assigned — side rail will not refresh after remote merge.");

        CatalogLoaded?.Invoke();
    }
}

[Serializable]
public class RemoteFurnitureListResponse
{
    public bool success;
    public int count;
    public List<RemoteFurnitureItem> furniture = new();
}

[Serializable]
public class RemoteFurnitureItem
{
    public string id;
    public string displayName;
    public string category;
    public string glbUrl;
    public string thumbnailUrl;
    public float width;
    public float height;
    public float depth;
    public string dimensionLabel;
}
