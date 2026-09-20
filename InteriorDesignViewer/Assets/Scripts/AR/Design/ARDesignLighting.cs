using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Drives scene lighting from ARCore's light estimation so placed furniture
/// picks up the room's real brightness, colour cast and light direction.
///
/// Intentionally does NOT use [RequireComponent(typeof(Light))] — older scenes
/// sometimes have "AR Estimated Light" without a Light, and RequireComponent
/// throws MissingComponentException before Awake can repair it.
/// </summary>
public class ARDesignLighting : MonoBehaviour
{
    [SerializeField] private ARCameraManager cameraManager;

    [Header("Estimation")]
    [Tooltip("Requested modes. Providers silently downgrade to what they support.")]
    [SerializeField]
    // Keep AR light estimation mild so fabric textures stay readable.
    // Spherical harmonics from bright rooms wash Shader Graph materials to chalk.
    private LightEstimation requestedLightEstimation =
        LightEstimation.AmbientIntensity |
        LightEstimation.AmbientColor |
        LightEstimation.MainLightDirection |
        LightEstimation.MainLightIntensity;

    [Header("Response")]
    [Tooltip("How quickly the light follows the estimate. Raw estimates flicker frame to frame.")]
    [SerializeField] private float smoothing = 6f;
    [Tooltip("Floor on brightness so a dim room does not render furniture as a silhouette.")]
    [SerializeField] private float minIntensity = 0.35f;
    [SerializeField] private float maxIntensity = 0.65f;

    Light directionalLight;
    float targetIntensity = 1f;
    Color targetColor = Color.white;
    Quaternion targetRotation;

    void Reset() => EnsureDirectionalLight();

    void Awake()
    {
        EnsureDirectionalLight();
        targetIntensity = Mathf.Max(directionalLight.intensity, minIntensity);
        targetColor = directionalLight.color;
        targetRotation = transform.rotation;

        if (cameraManager == null)
            cameraManager = FindFirstObjectByType<ARCameraManager>();
    }

    void OnEnable()
    {
        EnsureDirectionalLight();

        if (cameraManager == null)
            cameraManager = FindFirstObjectByType<ARCameraManager>();
        if (cameraManager == null) return;

        cameraManager.requestedLightEstimation = requestedLightEstimation;
        cameraManager.frameReceived += OnFrameReceived;

        // Flat ambient floor so furniture stays readable against passthrough
        // before the first light-estimation sample arrives.
        RenderSettings.ambientMode = AmbientMode.Flat;
        // Soft ambient — bright white ambient was washing textured furniture to chalk.
        RenderSettings.ambientLight = new Color(0.42f, 0.43f, 0.46f, 1f);
    }

    void OnDisable()
    {
        if (cameraManager != null)
            cameraManager.frameReceived -= OnFrameReceived;
    }

    void Update()
    {
        if (!EnsureDirectionalLight()) return;

        var t = 1f - Mathf.Exp(-smoothing * Time.deltaTime);

        directionalLight.intensity = Mathf.Lerp(directionalLight.intensity, targetIntensity, t);
        directionalLight.color = Color.Lerp(directionalLight.color, targetColor, t);
        transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, t);

        // Keep flat ambient in AR — spherical harmonics from the live camera feed
        // blow out any Lit fallback materials to flat white on bright floors.
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = Color.Lerp(
            RenderSettings.ambientLight,
            new Color(0.42f, 0.43f, 0.46f, 1f),
            t);
    }

    void OnFrameReceived(ARCameraFrameEventArgs args)
    {
        if (!EnsureDirectionalLight()) return;

        var estimation = args.lightEstimation;

            if (estimation.averageBrightness.HasValue)
        {
            targetIntensity = Mathf.Clamp(
                estimation.averageBrightness.Value * 0.9f, minIntensity, maxIntensity);
        }
        else if (estimation.mainLightIntensityLumens.HasValue)
        {
            targetIntensity = Mathf.Clamp(
                estimation.mainLightIntensityLumens.Value / 1200f, minIntensity, maxIntensity);
        }

        if (estimation.mainLightColor.HasValue)
            targetColor = estimation.mainLightColor.Value;
        else if (estimation.colorCorrection.HasValue)
            targetColor = estimation.colorCorrection.Value;

        if (estimation.mainLightDirection.HasValue)
        {
            var direction = estimation.mainLightDirection.Value;
            if (direction.sqrMagnitude > 1e-4f)
                targetRotation = Quaternion.LookRotation(direction.normalized);
        }

        if (estimation.averageColorTemperature.HasValue)
        {
            directionalLight.useColorTemperature = true;
            directionalLight.colorTemperature = estimation.averageColorTemperature.Value;
        }
    }

    bool EnsureDirectionalLight()
    {
        if (directionalLight == null)
            directionalLight = GetComponent<Light>();

        if (directionalLight == null)
            directionalLight = gameObject.AddComponent<Light>();

        if (directionalLight == null)
            return false;

        directionalLight.type = LightType.Directional;
        if (directionalLight.shadows == LightShadows.None)
            directionalLight.shadows = LightShadows.Soft;
        return true;
    }
}
