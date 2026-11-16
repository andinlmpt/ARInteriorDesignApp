#if UNITY_EDITOR
using System;
using System.Reflection;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>Batch checks of frame recovery and scan/layout teardown without a camera device.</summary>
public static class CameraLifecycleChecks
{
    const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    static int checks;

    public static void Run()
    {
        checks = 0;
        var host = new GameObject("Camera lifecycle checks");
        host.SetActive(false); // Recovery calls cannot start native AR in these checks.
        var bootstrap = host.AddComponent<ARBootstrap>();
        var watchdog = host.AddComponent<ARDesignCameraWatchdog>();
        Set(watchdog, "bootstrap", bootstrap);
        try
        {
            watchdog.ResetRecovery();
            Frame(watchdog, 1);
            Check(Get<string>(watchdog, "reportedState") == "ready", "a new camera frame reports ready");

            Set(watchdog, "lastFrameAt", -100f);
            Frame(watchdog, 1);
            Check(Get<float>(watchdog, "lastFrameAt") == -100f, "a repeated image timestamp does not count as a live frame");
            Frame(watchdog, 2);
            Check(Get<float>(watchdog, "lastFrameAt") >= 0f, "a new timestamp refreshes camera health");

            for (var attempt = 0; attempt < 4; attempt++)
            {
                Set(watchdog, "lastFrameAt", -100f);
                Set(watchdog, "nextRecoveryAt", -100f);
                Call(watchdog, "Update");
            }
            Check(Get<int>(watchdog, "recoveryAttempts") == 3, "automatic camera reacquisition is bounded");
            Check(Get<string>(watchdog, "reportedState") == "unavailable", "exhausted recovery exposes a retry action");
            Frame(watchdog, 3);
            Check(Get<int>(watchdog, "recoveryAttempts") == 0, "live frames reset recovery attempts");
            Check(Get<string>(watchdog, "reportedState") == "ready", "live frames clear the error");

            Set(bootstrap, "<CameraPermissionDenied>k__BackingField", true);
            Set(watchdog, "lastFrameAt", -100f);
            Set(watchdog, "nextRecoveryAt", -100f);
            Call(watchdog, "Update");
            Check(Get<int>(watchdog, "recoveryAttempts") == 0, "permission denial does not loop automatic retries");
            Set(bootstrap, "<CameraPermissionDenied>k__BackingField", false);

            var layout = host.AddComponent<ARDesignLayoutModeController>();
            Set(layout, "sessionActive", true);
            Set(layout, "viewMode", ARDesignLayoutModeController.ViewMode.Planner);
            Set(watchdog, "layoutMode", layout);
            Call(watchdog, "Update");
            Check(Get<int>(watchdog, "recoveryAttempts") == 0, "orbit view does not recover an intentionally stopped camera");
            Check(Get<string>(watchdog, "reportedState") == "inactive", "orbit view clears camera warnings without claiming live frames");

            var bridge = host.AddComponent<ARMeasurementRnBridge>();
            ARMeasurementRnBridge.PendingDesignLayoutPayload = "pending layout";
            ARMeasurementSession.SetRoomName("Previous room");
            Call(bridge, "SoftClose", false, true);
            Check(!ARMeasurementRnBridge.HasPendingDesignLayout, "exit clears a pending layout boot");
            Check(ARMeasurementSession.RoomName == string.Empty, "exit clears the previous scan name");
            ARMeasurementRnBridge.PendingDesignLayoutPayload = "current layout";
            Call(bridge, "SoftClose", false, false);
            Check(ARMeasurementRnBridge.HasPendingDesignLayout, "layout handoff preserves its boot payload");
            Debug.Log($"[CameraLifecycleChecks] Passed {checks} frame recovery and teardown checks.");
        }
        finally
        {
            ARMeasurementRnBridge.PendingDesignLayoutPayload = null;
            UnityEngine.Object.DestroyImmediate(host);
        }
    }

    static void Frame(ARDesignCameraWatchdog target, long timestamp) =>
        Call(target, "OnCameraFrame", new ARCameraFrameEventArgs { timestampNs = timestamp });
    static void Set(object target, string name, object value) => target.GetType().GetField(name, Private).SetValue(target, value);
    static T Get<T>(object target, string name) => (T)target.GetType().GetField(name, Private).GetValue(target);
    static void Call(object target, string name, params object[] args) => target.GetType().GetMethod(name, Private).Invoke(target, args);
    static void Check(bool success, string message)
    {
        checks++;
        if (!success) throw new Exception("[CameraLifecycleChecks] " + message);
    }
}
#endif
