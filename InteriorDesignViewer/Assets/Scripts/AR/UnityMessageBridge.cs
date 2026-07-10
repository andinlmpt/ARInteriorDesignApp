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
        var message = $"{{\"event\":\"{eventName}\",\"data\":\"{payload}\"}}";
        Debug.Log($"[UnityMessageBridge] {message}");

#if UNITY_ANDROID || UNITY_IOS
        // NativeAPI.SendMessageToRN(message);
#endif
    }
}

[Serializable]
public class RNMessage
{
    public string method;
    public string data;
}
