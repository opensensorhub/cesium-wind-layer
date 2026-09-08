#version 300 es
precision highp float;

//in vec4 speed;
in float timeAlpha;
in vec2 textureCoordinate;

uniform vec2 domain;
uniform vec2 displayRange;
uniform sampler2D colorTable;
uniform sampler2D segmentsDepthTexture;

out vec4 fragColor;

void main() {
    // float inRange = float(speed.a > 0.0 && speed.b > displayRange.x && speed.b < displayRange.y);
    // float speedLength = clamp(speed.b, domain.x, domain.y);
    // float normalizedSpeed = (speedLength - domain.x) / (domain.y - domain.x);
    // vec4 baseColor = texture(colorTable, vec2(normalizedSpeed, 0.0));

    // 组合颜色和透明度
    //fragColor = vec4(baseColor.rgb * inRange, inRange * timeAlpha);

    fragColor = vec4(1.0);


    float segmentsDepth = texture(segmentsDepthTexture, textureCoordinate).r;
    float globeDepth = czm_unpackDepth(texture(czm_globeDepthTexture, textureCoordinate));
    if (segmentsDepth < globeDepth) {
        fragColor = vec4(0.0);
    }
}