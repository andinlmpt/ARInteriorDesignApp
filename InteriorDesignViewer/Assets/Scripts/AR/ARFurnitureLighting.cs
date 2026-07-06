using UnityEngine;

/// <summary>
/// Key + fill directional lights for AR furniture (virtual lighting on 3D models).
/// </summary>
public class ARFurnitureLighting : MonoBehaviour
{
    [Header("Key light")]
    [SerializeField] private Color keyColor = new(1f, 0.97f, 0.92f);
    [SerializeField] private float keyIntensity = 1.1f;
    [SerializeField] private Vector3 keyEuler = new(50f, -35f, 0f);

    [Header("Fill light")]
    [SerializeField] private Color fillColor = new(0.78f, 0.86f, 1f);
    [SerializeField] private float fillIntensity = 0.4f;
    [SerializeField] private Vector3 fillEuler = new(22f, 130f, 0f);

    [Header("Optional references (auto-created if empty)")]
    [SerializeField] private Light keyLight;
    [SerializeField] private Light fillLight;

    void Awake()
    {
        keyLight = EnsureDirectionalLight(transform, "AR Key Light", keyLight, keyColor, keyIntensity, keyEuler);
        fillLight = EnsureDirectionalLight(transform, "AR Fill Light", fillLight, fillColor, fillIntensity, fillEuler);
    }

    static Light EnsureDirectionalLight(Transform parent, string lightName, Light existing, Color color, float intensity, Vector3 euler)
    {
        if (existing != null)
        {
            Configure(existing, color, intensity, euler);
            return existing;
        }

        var lightObject = new GameObject(lightName);
        lightObject.transform.SetParent(parent, false);

        var light = lightObject.AddComponent<Light>();
        Configure(light, color, intensity, euler);
        return light;
    }

    static void Configure(Light light, Color color, float intensity, Vector3 euler)
    {
        light.type = LightType.Directional;
        light.color = color;
        light.intensity = intensity;
        light.shadows = LightShadows.None;
        light.transform.rotation = Quaternion.Euler(euler);
    }
}
