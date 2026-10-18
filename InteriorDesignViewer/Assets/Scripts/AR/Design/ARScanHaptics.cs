using UnityEngine;

/// <summary>
/// Short taps of the vibration motor for scan moments (floor set, corner found, …). Uses Android's
/// built-in click effects where the phone has them, never Unity's long Handheld.Vibrate. Does
/// nothing in the editor, on phones without a vibrator, or if the call ever fails.
/// </summary>
public static class ARScanHaptics
{
    public enum Kind
    {
        Tick,
        Success,
        Warning,
    }

    const float MinGapSeconds = 0.08f;
    static float lastPlayedAt = -1f;

#if UNITY_ANDROID && !UNITY_EDITOR
    static AndroidJavaObject vibrator;
    static AndroidJavaClass effectClass;
    static int sdk;
    static bool unavailable;
#endif

    public static void Play(Kind kind)
    {
        var now = Time.unscaledTime;
        if (lastPlayedAt >= 0f && now - lastPlayedAt < MinGapSeconds) return;
        lastPlayedAt = now;

#if UNITY_ANDROID && !UNITY_EDITOR
        if (unavailable) return;
        try
        {
            if (vibrator == null && !TryInit())
            {
                unavailable = true;
                return;
            }

            if (sdk >= 29)
            {
                // VibrationEffect.EFFECT_TICK = 2, EFFECT_DOUBLE_CLICK = 1, EFFECT_HEAVY_CLICK = 5.
                var effectId = kind switch { Kind.Success => 1, Kind.Warning => 5, _ => 2 };
                using var effect = effectClass.CallStatic<AndroidJavaObject>("createPredefined", effectId);
                vibrator.Call("vibrate", effect);
            }
            else if (sdk >= 26)
            {
                // -1 = VibrationEffect.DEFAULT_AMPLITUDE.
                using var effect = effectClass.CallStatic<AndroidJavaObject>("createOneShot", Milliseconds(kind), -1);
                vibrator.Call("vibrate", effect);
            }
            else
            {
                vibrator.Call("vibrate", Milliseconds(kind));
            }
        }
        catch (System.Exception e)
        {
            unavailable = true;
            Debug.LogWarning($"[ARScanHaptics] Vibration unavailable: {e.Message}");
        }
#endif
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    static long Milliseconds(Kind kind) => kind switch { Kind.Success => 40L, Kind.Warning => 60L, _ => 15L };

    static bool TryInit()
    {
        using (var version = new AndroidJavaClass("android.os.Build$VERSION"))
            sdk = version.GetStatic<int>("SDK_INT");

        using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
        using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
        if (activity == null) return false;

        var service = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
        if (service == null || !service.Call<bool>("hasVibrator"))
        {
            service?.Dispose();
            return false;
        }

        vibrator = service;
        if (sdk >= 26) effectClass = new AndroidJavaClass("android.os.VibrationEffect");
        return true;
    }
#endif
}
