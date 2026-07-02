using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

public class ARFurniturePlacer : MonoBehaviour
{
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private GameObject placementIndicator;
    [SerializeField] private Transform furnitureParent;

    private GameObject activePrefab;
    private GameObject placedInstance;
    private readonly List<ARRaycastHit> hits = new();

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
    }

    void Update()
    {
        if (activePrefab == null || raycastManager == null) return;

        var screenCenter = new Vector2(Screen.width / 2f, Screen.height / 2f);
        if (raycastManager.Raycast(screenCenter, hits, TrackableType.PlaneWithinPolygon))
        {
            var pose = hits[0].pose;
            if (placementIndicator != null)
            {
                placementIndicator.SetActive(true);
                placementIndicator.transform.SetPositionAndRotation(pose.position, pose.rotation);
            }

            if (WasTapThisFrame())
            {
                PlaceFurniture(pose);
            }
        }
        else if (placementIndicator != null)
        {
            placementIndicator.SetActive(false);
        }
    }

    bool WasTapThisFrame()
    {
        if (Touch.activeTouches.Count > 0 && Touch.activeTouches[0].phase == TouchPhase.Began)
        {
            return true;
        }

#if UNITY_EDITOR
        if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
        {
            return true;
        }
#endif

        return false;
    }

    public void SetPrefab(GameObject prefab)
    {
        activePrefab = prefab;
    }

    public void ClearPlacedFurniture()
    {
        if (placedInstance != null)
        {
            Destroy(placedInstance);
            placedInstance = null;
        }
    }

    void PlaceFurniture(Pose pose)
    {
        if (activePrefab == null) return;

        if (placedInstance != null)
        {
            Destroy(placedInstance);
        }

        placedInstance = Instantiate(activePrefab, pose.position, pose.rotation, furnitureParent);
        UnityMessageBridge.SendToApp("furniturePlaced", placedInstance.name);
    }
}
