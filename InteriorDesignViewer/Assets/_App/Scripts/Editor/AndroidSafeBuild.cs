#if UNITY_EDITOR
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

/// <summary>
/// Builds Android APK without failing on connected-device OpenGL checks.
/// Unity 6 queries "adb shell dumpsys SurfaceFlinger" during Prepare For Build;
/// some phones (e.g. Xiaomi) return exit code 255 and block the build.
/// </summary>
public static class AndroidSafeBuild
{
    const string OutputFolder = "frontend/unity/builds/android";
    const string DefaultApkName = "ARRoomMeasurement.apk";

    [MenuItem("AR Interior/Build Android APK (No Device Check)", false, 30)]
    public static void BuildAndroidApkSafe()
    {
        if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
        {
            if (!EditorUtility.DisplayDialog(
                    "Switch to Android?",
                    "Active build target is not Android. Switch now and continue?",
                    "Switch",
                    "Cancel"))
                return;

            EditorUserBuildSettings.SwitchActiveBuildTarget(
                BuildTargetGroup.Android,
                BuildTarget.Android);
        }

        var scenes = EditorBuildSettings.scenes
            .Where(s => s.enabled)
            .Select(s => s.path)
            .Where(p => !string.IsNullOrEmpty(p))
            .ToArray();

        if (scenes.Length == 0)
        {
            EditorUtility.DisplayDialog(
                "AR Interior",
                "No scenes are enabled in Build Profiles.\n\nEnable ARRoomMeasurement (or your target scene) first.",
                "OK");
            return;
        }

        var projectRoot = Directory.GetParent(Application.dataPath)?.FullName;
        if (string.IsNullOrEmpty(projectRoot))
            return;

        var outputDir = Path.Combine(Directory.GetParent(projectRoot)!.FullName, OutputFolder.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(outputDir);

        var defaultPath = Path.Combine(outputDir, DefaultApkName);
        var apkPath = EditorUtility.SaveFilePanel(
            "Save Android APK",
            outputDir,
            Path.GetFileName(defaultPath),
            "apk");

        if (string.IsNullOrEmpty(apkPath))
            return;

        if (CountAdbDevices() > 0)
        {
            var proceed = EditorUtility.DisplayDialog(
                "Phone connected",
                "A USB device is connected. Unity may fail with:\n" +
                "\"Unable to query OpenGL version information\"\n\n" +
                "Unplug the USB cable (or turn off USB debugging), then click Continue.\n\n" +
                "Continue anyway?",
                "Continue",
                "Cancel");

            if (!proceed)
                return;
        }

        RestartAdb();

        var options = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = apkPath,
            target = BuildTarget.Android,
            targetGroup = BuildTargetGroup.Android,
            options = BuildOptions.None,
        };

        Debug.Log("[AR Interior] Building APK (adb restarted — device checks skipped)…");

        var report = BuildPipeline.BuildPlayer(options);
        RestartAdb();

        if (report.summary.result == BuildResult.Succeeded)
        {
            EditorUtility.DisplayDialog(
                "Build succeeded",
                $"APK saved to:\n{apkPath}\n\nInstall manually on your phone (copy file or use adb install).",
                "OK");
            EditorUtility.RevealInFinder(apkPath);
        }
        else
        {
            EditorUtility.DisplayDialog(
                "Build failed",
                $"Result: {report.summary.result}\n\n" +
                "If a phone is still connected, unplug USB and run this menu again.\n" +
                "Also ensure enough free space on C: drive.",
                "OK");
        }
    }

    [MenuItem("AR Interior/Restart ADB", false, 31)]
    public static void RestartAdbMenu()
    {
        RestartAdb();
        Debug.Log("[AR Interior] ADB restarted.");
    }

    static int CountAdbDevices()
    {
        var adb = FindAdbPath();
        if (string.IsNullOrEmpty(adb))
            return 0;

        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = adb,
                Arguments = "devices",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
            };

            using var process = System.Diagnostics.Process.Start(psi);
            if (process == null)
                return 0;

            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit(5000);

            return output
                .Split('\n')
                .Select(l => l.Trim())
                .Count(l => l.EndsWith("\tdevice"));
        }
        catch
        {
            return 0;
        }
    }

    static void RestartAdb()
    {
        var adb = FindAdbPath();
        if (string.IsNullOrEmpty(adb))
        {
            Debug.LogWarning("[AR Interior] adb not found — skip restart.");
            return;
        }

        RunProcess(adb, "kill-server");
        RunProcess(adb, "start-server");
    }

    static string FindAdbPath()
    {
        var editorPath = EditorApplication.applicationPath;
        var hubRoot = Directory.GetParent(editorPath)?.Parent?.FullName;
        if (hubRoot == null)
            return null;

        var adb = Path.Combine(
            hubRoot,
            "Data",
            "PlaybackEngines",
            "AndroidPlayer",
            "SDK",
            "platform-tools",
            "adb.exe");

        return File.Exists(adb) ? adb : null;
    }

    static void RunProcess(string exe, string args)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = exe,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };

            using var process = System.Diagnostics.Process.Start(psi);
            process?.WaitForExit(8000);
        }
        catch (System.Exception ex)
        {
            Debug.LogWarning($"[AR Interior] adb {args} failed: {ex.Message}");
        }
    }
}
#endif
