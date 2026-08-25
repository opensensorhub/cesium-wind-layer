export const renderTrailsVertexShader = /*glsl*/`#version 300 es
precision highp float;

in vec3 position;
in vec2 st;

out vec2 textureCoordinate;

void main() {
    textureCoordinate = st;
    gl_Position = vec4(position, 1.0);
}
`;

export const renderTrailsFragmentShader = /*glsl*/`#version 300 es
precision highp float;

in vec2 textureCoordinate;

uniform sampler2D segmentsColor;
uniform sampler2D trailsColor;

out vec4 fragColor;

void main() {
    vec4 segment = texture(segmentsColor, textureCoordinate);
    vec4 trail = texture(trailsColor, textureCoordinate);

    trail.a = floor(0.97 * 255.0 * trail.a) / 255.0;

    vec3 blendedRGB = mix(trail.rgb, segment.rgb, segment.a);
    float blendedAlpha = max(segment.a, trail.a);

    fragColor = vec4(blendedRGB, blendedAlpha);
}
`;
