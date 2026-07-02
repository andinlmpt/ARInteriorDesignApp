using System.Collections;
using UnityEngine;

public class WebGLBridge : MonoBehaviour
{
    IEnumerator Start()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        // Wait for Unity WebGL to finish loading
        yield return new WaitForSeconds(1f);

        // Create the function your React Native app calls
        Application.ExternalEval(@"
            window.SendMessageToUnity = function(msg) {
                if (typeof unityInstance !== 'undefined') {
                    unityInstance.SendMessage('Bridge', 'OnMessageFromApp', msg);
                }
            };
        ");

        // Tell React Native that Unity is ready
        Application.ExternalEval(@"
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: 'unityReady', ready: true })
                );
            }
        ");
#else
        yield return null;
#endif
    }
}