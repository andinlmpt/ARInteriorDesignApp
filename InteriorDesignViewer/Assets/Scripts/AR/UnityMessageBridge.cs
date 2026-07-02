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

        // Auto-select default prefab so you can test placement before React Native is wired.
        if (catalog != null && placer != null)
        {
            placer.SetPrefab(catalog.GetPrefab("test-sofa"));
        }
    }

    // Called from React Native later via @azesmway/react-native-unity
    public void ReceiveMessage(string json)
    {
        var msg = JsonUtility.FromJson<RNMessage>(json);
        if (msg == null || string.IsNullOrEmpty(msg.method)) return;

        if (msg.method == "selectFurniture")
        {
            var prefab = catalog != null ? catalog.GetPrefab(msg.data) : null;
            if (placer != null && prefab != null)
            {
                placer.SetPrefab(prefab);
            }
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
        // Hook this up when react-native-unity is installed (Phase G in docs).
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
