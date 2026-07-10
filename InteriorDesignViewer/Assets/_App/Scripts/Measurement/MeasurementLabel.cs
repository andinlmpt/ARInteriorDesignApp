using TMPro;
using UnityEngine;

/// <summary>
/// World-space distance label that always faces the main camera.
/// Attach to MeasurementLabel.prefab root (World Space Canvas child with TMP_Text).
/// </summary>
public class MeasurementLabel : MonoBehaviour
{
    [SerializeField] private TMP_Text labelText;
    [SerializeField] private Transform billboardTarget;

    void Awake()
    {
        if (labelText == null)
            labelText = GetComponentInChildren<TMP_Text>();

        if (billboardTarget == null)
            billboardTarget = transform;
    }

    void LateUpdate()
    {
        var camera = Camera.main;
        if (camera == null || billboardTarget == null)
            return;

        billboardTarget.rotation = Quaternion.LookRotation(
            billboardTarget.position - camera.transform.position,
            Vector3.up);
    }

    public void SetText(string value)
    {
        if (labelText != null)
            labelText.text = value;
    }
}
