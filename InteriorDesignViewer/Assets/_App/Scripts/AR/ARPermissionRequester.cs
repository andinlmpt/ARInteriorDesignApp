using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
#if UNITY_ANDROID
using UnityEngine.Android;
#endif

/// <summary>
/// Requests camera permission and enables AR Session on Android before tracking begins.
/// Attach to the same GameObject as AR Session (or reference it in the Inspector).
/// </summary>
[DefaultExecutionOrder(-1000)]
public class ARPermissionRequester : MonoBehaviour
{
    [SerializeField] private ARSession arSession;

    void Awake()
    {
        if (arSession == null)
            arSession = GetComponent<ARSession>();

#if UNITY_ANDROID && !UNITY_EDITOR
        if (arSession != null)
            arSession.enabled = false;
#endif
    }

    IEnumerator Start()
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
        {
            Permission.RequestUserPermission(Permission.Camera);

            var elapsed = 0f;
            while (!Permission.HasUserAuthorizedPermission(Permission.Camera) && elapsed < 60f)
            {
                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }
        }

        if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
        {
            Debug.LogError("[ARPermissionRequester] Camera permission not granted.");
            yield break;
        }

        if (arSession == null)
            yield break;

        arSession.enabled = true;
        yield return ARSession.CheckAvailability();

        if (ARSession.state == ARSessionState.NeedsInstall)
            yield return ARSession.Install();

        arSession.Reset();
#else
        yield break;
#endif
    }
}
