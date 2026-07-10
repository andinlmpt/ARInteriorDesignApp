using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

public class PlacementManager : MonoBehaviour
{
    public ARRaycastManager raymanager;
    public GameObject PointObj;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        raymanager = FindObjectOfType<ARRaycastManager>();
        PointObj = this.transform.GetChild(0).gameObject;
        PointObj.SetActive(false);
    }

    // Update is called once per frame
    void Update()
    {
        List<ARRaycastHit> hitpoint = new List<ARRaycastHit>();
        raymanager.Raycast(new Vector2(Screen.width / 2, Screen.height / 2), hitpoint, TrackableType.Planes);

        if (hitpoint.Count > 0)
        {
            transform.position = hitpoint[0].pose.position;
            transform.rotation = hitpoint[0].pose.rotation;

            if (!PointObj.activeInHierarchy)
            {
                PointObj.SetActive(true);
            }
        }
    }
}