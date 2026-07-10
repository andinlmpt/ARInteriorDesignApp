using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// Minimal launcher for standalone _App AR scenes.
/// Wire button OnClick events to LoadFurnitureScene / LoadMeasurementScene in the Inspector,
/// or assign scene names below.
/// </summary>
public class MainMenuController : MonoBehaviour
{
    [SerializeField] private string furnitureSceneName = "ARFurnitureDev";
    [SerializeField] private string measurementSceneName = "ARRoomMeasurement";

    [SerializeField] private Button furnitureButton;
    [SerializeField] private Button measurementButton;

    void Awake()
    {
        if (furnitureButton != null)
            furnitureButton.onClick.AddListener(LoadFurnitureScene);

        if (measurementButton != null)
            measurementButton.onClick.AddListener(LoadMeasurementScene);
    }

    void OnDestroy()
    {
        if (furnitureButton != null)
            furnitureButton.onClick.RemoveListener(LoadFurnitureScene);

        if (measurementButton != null)
            measurementButton.onClick.RemoveListener(LoadMeasurementScene);
    }

    public void LoadFurnitureScene()
    {
        SceneManager.LoadScene(furnitureSceneName);
    }

    public void LoadMeasurementScene()
    {
        SceneManager.LoadScene(measurementSceneName);
    }
}
