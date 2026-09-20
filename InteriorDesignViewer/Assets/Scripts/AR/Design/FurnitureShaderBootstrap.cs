using UnityEngine;

/// <summary>
/// Forces <c>ARInterior/FurnitureUnlit</c> into player builds by touching the
/// Resources reference material before any scene loads.
/// </summary>
public static class FurnitureShaderBootstrap
{
    static Material keepAlive;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void KeepFurnitureShaderAlive()
    {
        keepAlive = Resources.Load<Material>("AR/FurnitureArUnlit");
        if (keepAlive == null || keepAlive.shader == null
            || keepAlive.shader.name.Contains("InternalError"))
        {
            Debug.LogError(
                "[FurnitureShaderBootstrap] Resources/AR/FurnitureArUnlit.mat missing or broken. " +
                "Furniture will render magenta on device.");
            return;
        }

        // Touch shader so the player build linker cannot strip it.
        var shader = keepAlive.shader;
        if (Shader.Find("ARInterior/FurnitureUnlit") == null)
            Debug.LogWarning("[FurnitureShaderBootstrap] Shader.Find failed; Resources material still holds reference.");
        else
            Debug.Log($"[FurnitureShaderBootstrap] Furniture shader ready: {shader.name}");
    }
}
