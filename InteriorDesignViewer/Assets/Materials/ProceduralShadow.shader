Shader "Universal Render Pipeline/ProceduralShadow"
{
    Properties
    {
        _ShadowStrength ("Shadow Strength", Range(0, 1)) = 0.55
        _Softness ("Softness", Range(0.01, 1.0)) = 0.45
    }
    SubShader
    {
        Tags 
        { 
            "RenderType"="Transparent" 
            "Queue"="Transparent" 
            "RenderPipeline" = "UniversalPipeline" 
            "IgnoreProjector"="True"
        }
        LOD 100

        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off

        Pass
        {
            Name "Unlit"
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS   : POSITION;
                float2 uv           : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS   : SV_POSITION;
                float2 uv           : TEXCOORD0;
            };

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = input.uv;
                return output;
            }

            float _ShadowStrength;
            float _Softness;

            half4 frag(Varyings input) : SV_Target
            {
                // Calculate distance from center of UV space (0.5, 0.5)
                float2 uvCenter = input.uv - float2(0.5, 0.5);
                float dist = length(uvCenter);

                // Draw a soft circle with radius 0.5.
                // Alpha falls off from 1 to 0 between (0.5 - softness) and 0.5.
                float alpha = smoothstep(0.5, 0.5 - _Softness, dist);

                // Apply shadow strength
                alpha *= _ShadowStrength;

                // Return soft black shadow
                return half4(0.0, 0.0, 0.0, alpha);
            }
            ENDHLSL
        }
    }
}
