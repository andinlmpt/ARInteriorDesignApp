using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// World-space dimension chip shown above a placed furniture piece.
/// Uses the reference dimensions from the catalog (WPS / MongoDB), not mesh bounds.
/// </summary>
[DisallowMultipleComponent]
public class FurnitureDimensionLabel : MonoBehaviour
{
    [SerializeField] private float verticalOffsetMetres = 0.08f;
    [SerializeField] private float labelScale = 0.004f;

    PlacedFurniture placed;
    GameObject labelRoot;
    string labelText;

    public void Setup(PlacedFurniture target, string dimensionLabel)
    {
        placed = target;
        labelText = string.IsNullOrWhiteSpace(dimensionLabel)
            ? FurnitureDimensionFormat.FromCatalogMetres(target?.CatalogDimensions ?? Vector3.zero)
            : NormalizeLabel(dimensionLabel.Trim());

        if (string.IsNullOrWhiteSpace(labelText))
            labelText = "—";

        BuildLabel();
        RefreshPosition();
    }

    void LateUpdate()
    {
        RefreshPosition();
    }

    void RefreshPosition()
    {
        if (placed == null || labelRoot == null) return;

        var bounds = placed.LocalBounds;
        var topY = bounds.max.y * Mathf.Abs(placed.transform.localScale.y);
        labelRoot.transform.position = placed.transform.position + Vector3.up * (topY + verticalOffsetMetres);
    }

    void BuildLabel()
    {
        if (labelRoot != null)
            Destroy(labelRoot);

        labelRoot = new GameObject("FurnitureDimensionLabel");
        labelRoot.transform.SetParent(transform, false);

        var canvas = labelRoot.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.sortingOrder = 45;

        var rt = canvas.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(520f, 56f);
        labelRoot.transform.localScale = Vector3.one * labelScale;

        var bg = ARDesignUiUtil.CreateRoundedImage(labelRoot.transform, new Color(1f, 1f, 1f, 0.94f), 24);
        bg.raycastTarget = false;
        var bgRt = bg.rectTransform;
        bgRt.anchorMin = Vector2.zero;
        bgRt.anchorMax = Vector2.one;
        bgRt.offsetMin = Vector2.zero;
        bgRt.offsetMax = Vector2.zero;

        var text = ARDesignUiUtil.CreateText(bg.transform, labelText, 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = new Color(0.12f, 0.12f, 0.14f, 1f);
        text.raycastTarget = false;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(8f, 4f);
        textRt.offsetMax = new Vector2(-8f, -4f);

        labelRoot.AddComponent<ARDesignBillboard>();
    }

    static string NormalizeLabel(string label)
    {
        if (string.IsNullOrWhiteSpace(label)) return label;
        // API / JSON may use ASCII "x"; product sheet uses ×.
        return label
            .Replace(" x ", $" {FurnitureDimensionFormat.Multiply} ")
            .Replace(" X ", $" {FurnitureDimensionFormat.Multiply} ");
    }

    void OnDestroy()
    {
        if (labelRoot != null)
            Destroy(labelRoot);
    }
}
