#version 300 es
precision highp float;

in vec2 textureCoordinate;

uniform sampler2D segmentsColor;
uniform sampler2D trailsColor;
uniform float trailFade;

out vec4 fragColor;

void main() {
    vec4 segment = texture(segmentsColor, textureCoordinate);
    vec4 trail = texture(trailsColor, textureCoordinate);

    trail.a = floor(clamp(trailFade, 0.0, 1.0) * 255.0 * trail.a) / 255.0;

    fragColor = max(trail, segment);
}