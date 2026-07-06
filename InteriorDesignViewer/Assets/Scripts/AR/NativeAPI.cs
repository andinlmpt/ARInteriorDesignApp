using System.Runtime.InteropServices;
using UnityEngine;

public static class NativeAPI
{
#if UNITY_IOS && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void sendMessageToMobileApp(string message);
#endif

    public static void SendMessageToRN(string message)
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        try
        {
            using (var jc = new AndroidJavaClass("com.azesmwayreactnativeunity.ReactNativeUnityViewManager"))
            {
                jc.CallStatic("sendMessageToMobileApp", message);
                return;
            }
        }
        catch (System.Exception)
        {
            // Standalone Unity APK — RN bridge is not embedded yet.
            Debug.Log($"[NativeAPI] {message}");
        }
#elif UNITY_IOS && !UNITY_EDITOR
        sendMessageToMobileApp(message);
#else
        Debug.Log($"[NativeAPI] {message}");
#endif
    }
}
