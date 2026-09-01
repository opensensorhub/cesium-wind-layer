#version 300 es
precision highp float;

in vec4 speed;
in float timeAlpha;

uniform vec2 domain;
uniform vec2 displayRange;
uniform sampler2D colorTable;

out vec4 fragColor;

void main() {
    float inRange = float(speed.a > 0.0 && speed.b > displayRange.x && speed.b < displayRange.y);
    float speedLength = clamp(speed.b, domain.x, domain.y);
    float normalizedSpeed = (speedLength - domain.x) / (domain.y - domain.x);
    vec4 baseColor = texture(colorTable, vec2(normalizedSpeed, 0.0));

    // 组合颜色和透明度
    fragColor = vec4(baseColor.rgb * inRange, inRange * timeAlpha);
}