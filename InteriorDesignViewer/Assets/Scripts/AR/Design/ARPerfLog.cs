using UnityEngine;

/// <summary>
/// Every few seconds logs the frame rate, the slowest frame and how many frames were slow
/// ("[Perf] …" in logcat), so a phone test shows where the scan stutters.
/// </summary>
public class ARPerfLog : MonoBehaviour
{
    [SerializeField] private float intervalSeconds = 5f;
    [Tooltip("Frames slower than this count as a stutter.")]
    [SerializeField] private float slowFrameMs = 50f;

    float windowStart;
    int frames;
    int slowFrames;
    float slowestMs;

    public static ARPerfLog EnsureOn(GameObject host)
    {
        var existing = host.GetComponent<ARPerfLog>();
        return existing != null ? existing : host.AddComponent<ARPerfLog>();
    }

    void OnEnable() => ResetWindow();

    void Update()
    {
        var ms = Time.unscaledDeltaTime * 1000f;
        frames++;
        if (ms > slowFrameMs) slowFrames++;
        if (ms > slowestMs) slowestMs = ms;

        var elapsed = Time.unscaledTime - windowStart;
        if (elapsed < intervalSeconds) return;

        Debug.Log($"[Perf] {frames / elapsed:F1} fps, slowest frame {slowestMs:F0} ms, " +
                  $"{slowFrames} frames over {slowFrameMs:F0} ms in {elapsed:F1} s.");
        ResetWindow();
    }

    void ResetWindow()
    {
        windowStart = Time.unscaledTime;
        frames = 0;
        slowFrames = 0;
        slowestMs = 0f;
    }
}
