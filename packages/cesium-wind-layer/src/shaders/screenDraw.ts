export const screenDrawVertexShader = /*glsl*/`#version 300 es
    precision highp float;

    in vec2 st;
    in vec4 position;
    
    out vec2 texCoord;

    void main() {
        gl_Position = czm_modelViewProjection * position;
        texCoord = st;
    }
`;

export const screenDrawFragmentShader = /*glsl*/`#version 300 es
    precision highp float;

    in vec2 texCoord;

    uniform sampler2D tex;
    uniform float opacity;

    out vec4 fragColor;

    void main() {
        vec4 final = texture(tex, texCoord);
        fragColor = vec4(final.xyz, final.w * opacity);
    }
`;