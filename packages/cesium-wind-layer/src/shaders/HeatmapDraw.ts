export const renderHeatmapShader = /*glsl*/`#version 300 es
    uniform sampler2D U;
    uniform sampler2D V;
    uniform sampler2D colorTable;

    uniform bool useHeatmap;
    uniform vec2 domain;

    czm_material czm_getMaterial(czm_materialInput materialInput) {
        vec2 st = materialInput.st;
        czm_material m = czm_getDefaultMaterial(materialInput);

        float u = texture(U, st).r;
        float v = texture(V, st).r;
        vec2 uv = vec2(u, v);

        float speed = length(uv);

        float speedNormalized = (speed - domain.x)/(domain.y - domain.x);

        vec4 baseColor = texture(colorTable, vec2(speedNormalized, 0.0));

        m.diffuse = baseColor.rgb;     
        m.alpha = useHeatmap ? 0.5 : 0.0;
        return m; 
    }
`;