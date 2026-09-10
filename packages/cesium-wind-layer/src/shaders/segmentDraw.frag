#version 300 es
precision highp float;

in float alpha;
in float speed;

uniform sampler2D colorTable;

out vec4 fragColor;

void main() {
    vec4 baseColor = texture(colorTable, vec2(speed, 0.0));

    fragColor = vec4(baseColor.rgb, alpha);
}