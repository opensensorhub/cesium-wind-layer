#version 300 es
precision highp float;

in vec2 texCoord;

uniform sampler2D tex;
uniform float opacity;

out vec4 fragColor;

void main() {
    vec4 final = texture(tex, texCoord);
    fragColor = vec4(final.xyz, final.w * opacity);
}