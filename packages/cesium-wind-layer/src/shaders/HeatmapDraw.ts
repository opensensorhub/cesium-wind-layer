export const renderHeatmapVertexShader = /*glsl*/`#version 300 es
    precision highp float;

    in vec2 st;
    in vec4 position;

    uniform sampler2D U;
    uniform sampler2D V;

    out float speed;
    
    void main() {
        float u = texture(U, st).r;
        float v = texture(V, st).r;
        vec2 uv = vec2(u, v);

        speed = length(uv);

        gl_Position = czm_modelViewProjection * position;
    }
`;

export const renderHeatmapFragmentShader = /*glsl*/`#version 300 es
    precision highp float;

    in float speed;

    uniform sampler2D colorTable;
    uniform vec2 domain;
    uniform float opacity;

    out vec4 fragColor;

    void main() {

        float speedNormalized = (speed - domain.x)/(domain.y - domain.x);

        vec4 baseColor = texture(colorTable, vec2(speedNormalized, 0.0));

        fragColor = vec4(baseColor.rgb, opacity * 0.5); 
    }
`;