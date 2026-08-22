using System;
using UnityEngine;

public class UnityMessageBridge : MonoBehaviour
{
    public static UnityMessageBridge Instance { get; private set; }

    [SerializeField] private ARFurniturePlacer placer;
    [SerializeField] private FurnitureCatalog catalog;

    void Awake()
    {
        Instance = this;
    }

    void Start()
    {
        SendToApp("unityReady", "true");
    }

    public void ReceiveMessage(string json)
    {
        var msg = JsonUtility.FromJson<RNMessage>(json);
        if (msg == null || string.IsNullOrEmpty(msg.method)) return;

        if (msg.method == "selectFurniture")
        {
            var prefab = catalog != null ? catalog.GetPrefab(msg.data) : null;
            if (placer != null && prefab != null)
                placer.SetPrefab(prefab);
        }
        else if (msg.method == "clearFurniture" && placer != null)
        {
            placer.ClearPlacedFurniture();
        }
    }

    public static void SendToApp(string eventName, string payload)
    {
        var message = $"{{\"event\":\"{Escape(eventName)}\",\"data\":\"{Escape(payload)}\"}}";
        Debug.Log($"[UnityMessageBridge] {message}");

#if UNITY_ANDROID || UNITY_IOS
        NativeAPI.SendMessageToRN(message);
#endif
    }

    /// <summary>
    /// Escapes a value for embedding inside the "data" string field.
    /// ARDesignScene sends JSON-encoded payloads through here, so the quotes and
    /// braces they contain must not terminate the envelope early.
    /// </summary>
    static string Escape(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        var builder = new System.Text.StringBuilder(value.Length + 16);

        foreach (var c in value)
        {
            switch (c)
            {
                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\b': builder.Append("\\b"); break;
                case '\f': builder.Append("\\f"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (c < 0x20)
                        builder.Append("\\u").Append(((int)c).ToString("x4"));
                    else
                        builder.Append(c);
                    break;
            }
        }

        return builder.ToString();
    }
}

[Serializable]
public class RNMessage
{
    public string method;
    public string data;
}
