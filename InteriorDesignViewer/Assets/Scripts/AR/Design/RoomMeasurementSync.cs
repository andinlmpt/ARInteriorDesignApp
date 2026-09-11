using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Saves confirmed room measurements to the backend (MongoDB) after scan confirm.
/// Works in Unity Build And Run (standalone) without React Native.
/// </summary>
public class RoomMeasurementSync : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [Tooltip("Backend endpoint, e.g. http://192.168.1.7:3000/api/v1/room-measurements")]
    [SerializeField] private string saveUrl = "http://192.168.1.7:3000/api/v1/room-measurements";
    [SerializeField] private bool saveOnConfirm = false;
    [SerializeField] private float requestTimeoutSeconds = 15f;

    public bool LastSaveSucceeded { get; private set; }
    public string LastError { get; private set; }

    void Awake()
    {
        if (scanController == null)
            scanController = FindFirstObjectByType<RoomScanController>();
    }

    void OnEnable()
    {
        if (scanController != null)
            scanController.PhaseChanged += OnPhaseChanged;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhaseChanged;
    }

    void OnPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (!saveOnConfirm || phase != RoomScanController.ScanPhase.Confirmed) return;
        if (scanController == null) return;
#if UNITY_ANDROID
        if (ARDesignHostDetect.IsEmbeddedInReactNative())
            return;
#endif
        var payload = RoomMeasurementPayloadBuilder.Build(scanController);
        SaveMeasurement(payload);
    }

    public void SaveMeasurement(RoomConfirmedPayload payload)
    {
        StopAllCoroutines();
        StartCoroutine(SaveCoroutine(payload));
    }

    IEnumerator SaveCoroutine(RoomConfirmedPayload payload)
    {
        LastSaveSucceeded = false;
        LastError = null;

        if (string.IsNullOrWhiteSpace(saveUrl))
        {
            LastError = "Room measurement save URL is empty.";
            Debug.LogWarning($"[RoomMeasurementSync] {LastError}");
            yield break;
        }

        var json = JsonUtility.ToJson(payload.ToSaveRequest());
        var bodyRaw = Encoding.UTF8.GetBytes(json);

        using var request = new UnityWebRequest(saveUrl.Trim(), UnityWebRequest.kHttpVerbPOST);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        request.timeout = Mathf.Max(1, Mathf.RoundToInt(requestTimeoutSeconds));

        yield return request.SendWebRequest();

#if UNITY_2020_2_OR_NEWER
        if (request.result != UnityWebRequest.Result.Success)
#else
        if (request.isNetworkError || request.isHttpError)
#endif
        {
            LastError = request.error;
            Debug.LogWarning($"[RoomMeasurementSync] Save failed: {request.error}\n{request.downloadHandler.text}");
            yield break;
        }

        LastSaveSucceeded = true;
        Debug.Log($"[RoomMeasurementSync] Room measurement saved ({payload.dimensionLabel}).");
    }
}
