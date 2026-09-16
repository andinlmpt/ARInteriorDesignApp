using System.IO;
using UnityEngine;

/// <summary>
/// Saves PNGs into the device Photos / Gallery (MediaStore on Android).
/// Share sheets often omit a Gallery target — this writes there directly.
/// </summary>
public static class ARPhotoGallerySaver
{
    const string AlbumFolder = "ARInteriorDesign";

    /// <returns>True when the image was inserted into the system gallery.</returns>
    public static bool SavePngToGallery(byte[] pngBytes, string fileName)
    {
        if (pngBytes == null || pngBytes.Length == 0 || string.IsNullOrWhiteSpace(fileName))
            return false;

        if (!fileName.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase))
            fileName += ".png";

#if UNITY_EDITOR
        var editorDir = Path.Combine(Application.persistentDataPath, "ARPhotos");
        Directory.CreateDirectory(editorDir);
        var editorPath = Path.Combine(editorDir, fileName);
        File.WriteAllBytes(editorPath, pngBytes);
        Debug.Log($"[ARPhotoGallerySaver] Editor fallback saved: {editorPath}");
        return true;
#elif UNITY_ANDROID
        return SavePngToAndroidGallery(pngBytes, fileName);
#elif UNITY_IOS
        return SavePngToIosPhotos(pngBytes, fileName);
#else
        Debug.LogWarning("[ARPhotoGallerySaver] Gallery save is not supported on this platform.");
        return false;
#endif
    }

    public static bool SavePngFileToGallery(string absolutePath, string fileName = null)
    {
        if (string.IsNullOrEmpty(absolutePath) || !File.Exists(absolutePath))
            return false;

        fileName ??= Path.GetFileName(absolutePath);
        return SavePngToGallery(File.ReadAllBytes(absolutePath), fileName);
    }

#if UNITY_ANDROID
    static bool SavePngToAndroidGallery(byte[] pngBytes, string fileName)
    {
        try
        {
            using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
            using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            using var resolver = activity.Call<AndroidJavaObject>("getContentResolver");
            using var contentValues = new AndroidJavaObject("android.content.ContentValues");

            contentValues.Call<AndroidJavaObject>("put", "_display_name", fileName);
            contentValues.Call<AndroidJavaObject>("put", "mime_type", "image/png");
            contentValues.Call<AndroidJavaObject>("put", "title", fileName);

            // Android 10+ (API 29): write into public Pictures album without legacy storage permission.
            var sdkInt = GetAndroidSdkInt();
            if (sdkInt >= 29)
            {
                contentValues.Call<AndroidJavaObject>(
                    "put",
                    "relative_path",
                    "Pictures/" + AlbumFolder);
                contentValues.Call<AndroidJavaObject>("put", "is_pending", 1);
            }

            using var images = new AndroidJavaClass("android.provider.MediaStore$Images$Media");
            using var collection = images.GetStatic<AndroidJavaObject>("EXTERNAL_CONTENT_URI");
            using var uri = resolver.Call<AndroidJavaObject>("insert", collection, contentValues);
            if (uri == null)
            {
                Debug.LogWarning("[ARPhotoGallerySaver] MediaStore insert returned null.");
                return false;
            }

            using var outputStream = resolver.Call<AndroidJavaObject>("openOutputStream", uri);
            if (outputStream == null)
            {
                Debug.LogWarning("[ARPhotoGallerySaver] openOutputStream returned null.");
                return false;
            }

            outputStream.Call("write", pngBytes);
            outputStream.Call("flush");
            outputStream.Call("close");

            if (sdkInt >= 29)
            {
                contentValues.Call("clear");
                contentValues.Call<AndroidJavaObject>("put", "is_pending", 0);
                resolver.Call<int>("update", uri, contentValues, null, null);
            }

            Debug.Log($"[ARPhotoGallerySaver] Saved to Android gallery: {fileName}");
            return true;
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARPhotoGallerySaver] Android gallery save failed: {e.Message}");
            return false;
        }
    }

    static int GetAndroidSdkInt()
    {
        using var version = new AndroidJavaClass("android.os.Build$VERSION");
        return version.GetStatic<int>("SDK_INT");
    }
#endif

#if UNITY_IOS
    static bool SavePngToIosPhotos(byte[] pngBytes, string fileName)
    {
        // Without a Photos plugin, keep a sandbox copy; Android is the primary gallery path.
        try
        {
            var dir = Path.Combine(Application.persistentDataPath, "ARPhotos");
            Directory.CreateDirectory(dir);
            File.WriteAllBytes(Path.Combine(dir, fileName), pngBytes);
            Debug.Log("[ARPhotoGallerySaver] iOS: wrote sandbox copy (Photos plugin not configured).");
            return false;
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARPhotoGallerySaver] iOS fallback failed: {e.Message}");
            return false;
        }
    }
#endif
}
