using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
#if UNITY_ANDROID
using UnityEngine.Android;
#endif

/// <summary>
/// Requests camera permission and starts AR Session after grant.
/// Unity export sets SkipPermissionsDialog; this ensures AR works on device.
/// </summary>
[DefaultExecutionOrder(-1000)]
public class ARBootstrap : MonoBehaviour
{
    [SerializeField] private ARSession arSession;

    void Awake()
    {
        if (arSession == null)
        {
            arSession = GetComponent<ARSession>();
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        if (arSession != null)
        {
            arSession.enabled = false;
        }
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
            Debug.LogError("[ARBootstrap] Camera permission not granted.");
            yield break;
        }

        if (arSession == null)
        {
            yield break;
        }

        arSession.enabled = true;
        yield return ARSession.CheckAvailability();

        if (ARSession.state == ARSessionState.NeedsInstall)
        {
            yield return ARSession.Install();
        }

        arSession.Reset();
#else
        yield break;
#endif
    }
}
