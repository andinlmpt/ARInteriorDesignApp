using System;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>Checks actual frame delivery, with bounded recovery that preserves layout tracking.</summary>
[DefaultExecutionOrder(-950)]
public class ARDesignCameraWatchdog : MonoBehaviour
{
    [SerializeField] private ARBootstrap bootstrap;
    [SerializeField] private ARCameraManager cameraManager;
    [SerializeField] private ARCameraBackground cameraBackground;
    [SerializeField] private ARDesignLayoutModeController layoutMode;
    [SerializeField] private float frameTimeout = 8f;
    [SerializeField] private float recoveryInterval = 8f;
    const int MaxRecoveryAttempts = 3;

    float lastFrameAt;
    float nextRecoveryAt;
    long? lastTimestamp;
    int recoveryAttempts;
    string reportedState;
    string reportedMessage;

    [Serializable]
    class CameraStatus
    {
        public string state;
        public string message;
    }

    void Awake()
    {
        if (bootstrap == null) bootstrap = FindFirstObjectByType<ARBootstrap>();
        if (cameraManager == null) cameraManager = FindFirstObjectByType<ARCameraManager>();
        if (cameraBackground == null) cameraBackground = FindFirstObjectByType<ARCameraBackground>();
        if (layoutMode == null) layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
    }

    void OnEnable()
    {
        if (cameraManager != null) cameraManager.frameReceived += OnCameraFrame;
        ResetRecovery();
    }

    void OnDisable()
    {
        if (cameraManager != null) cameraManager.frameReceived -= OnCameraFrame;
    }

    public void ResetRecovery()
    {
        lastFrameAt = Time.unscaledTime;
        lastTimestamp = null;
        nextRecoveryAt = Time.unscaledTime + frameTimeout;
        recoveryAttempts = 0;
        reportedState = null;
    }

    public void ReportStatus(string state, string message)
    {
        if (reportedState == state) return;
        reportedState = state;
        reportedMessage = message;
        UnityMessageBridge.SendToApp("cameraStatus", JsonUtility.ToJson(new CameraStatus { state = state, message = message }));
    }

    public void SendCurrentStatus()
    {
        if (reportedState == null) return;
        var state = reportedState;
        reportedState = null;
        ReportStatus(state, reportedMessage);
    }

    void OnCameraFrame(ARCameraFrameEventArgs args)
    {
        if (layoutMode != null && layoutMode.IsPlannerOrbitActive) return;
        if (bootstrap != null && (bootstrap.CameraPermissionDenied || bootstrap.CameraUnsupported)) return;
        // An unchanged timestamp is the previous image, not proof of a live camera.
        if (args.timestampNs.HasValue && args.timestampNs == lastTimestamp) return;
        lastTimestamp = args.timestampNs;
        lastFrameAt = Time.unscaledTime;
        if (cameraBackground != null && !cameraBackground.enabled) return;
        recoveryAttempts = 0;
        ReportStatus("ready", string.Empty);
    }

    void Update()
    {
        if (layoutMode != null && layoutMode.IsPlannerOrbitActive)
        {
            // Orbit view intentionally stops requesting camera frames.
            lastFrameAt = Time.unscaledTime;
            nextRecoveryAt = Time.unscaledTime + frameTimeout;
            ReportStatus("inactive", string.Empty);
            return;
        }
        if (bootstrap == null || bootstrap.IsStarting || bootstrap.CameraPermissionDenied || bootstrap.CameraUnsupported) return;

        var backgroundOff = cameraBackground != null && !cameraBackground.enabled;
        if (!backgroundOff && Time.unscaledTime - lastFrameAt < frameTimeout) return;
        if (Time.unscaledTime < nextRecoveryAt) return;
        if (recoveryAttempts >= MaxRecoveryAttempts)
        {
            ReportStatus("unavailable", "The camera is not responding. Close other camera apps, then tap Retry camera.");
            return;
        }

        recoveryAttempts++;
        nextRecoveryAt = Time.unscaledTime + recoveryInterval;
        ReportStatus("recovering", "Reconnecting to the camera…");
        // Reacquire the camera without resetting the room's coordinate frame.
        bootstrap.ReacquireCamera();
    }

    void OnApplicationPause(bool paused)
    {
        if (!paused) ResetRecovery();
    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus) ResetRecovery();
    }
}
