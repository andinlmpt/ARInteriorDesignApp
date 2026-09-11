using UnityEngine;

/// <summary>
/// Formats catalog dimensions as L / W / H inch labels (product-sheet style).
/// Catalog metres: width=x (W), height=y (H), depth=z (L).
/// </summary>
public static class FurnitureDimensionFormat
{
    public const string Multiply = "×";

    public static string FromCatalogMetres(Vector3 dims)
    {
        if (dims.x <= 0.01f || dims.y <= 0.01f || dims.z <= 0.01f)
            return string.Empty;

        var lengthIn = MetresToInches(dims.z);
        var widthIn = MetresToInches(dims.x);
        var heightIn = MetresToInches(dims.y);
        return FromInches(lengthIn, widthIn, heightIn);
    }

    public static string FromInches(int lengthIn, int widthIn, int heightIn)
    {
        if (lengthIn <= 0 || widthIn <= 0 || heightIn <= 0)
            return string.Empty;

        return $"L {lengthIn}\" {Multiply} W {widthIn}\" {Multiply} H {heightIn}\"";
    }

    static int MetresToInches(float metres) =>
        Mathf.Max(1, Mathf.RoundToInt(metres / 0.0254f));
}
