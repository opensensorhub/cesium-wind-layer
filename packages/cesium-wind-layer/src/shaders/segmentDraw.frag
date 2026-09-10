#version 300 es
precision highp float;

in vec2 textureCoordinate;
in float alpha;
in float speed;

uniform sampler2D colorTable;
uniform sampler2D segmentsDepthTexture;

out vec4 fragColor;

void main() {
    vec4 baseColor = texture(colorTable, vec2(speed, 0.0));

    fragColor = vec4(baseColor.rgb, alpha);


    float segmentsDepth = texture(segmentsDepthTexture, textureCoordinate).r;
    float globeDepth = czm_unpackDepth(texture(czm_globeDepthTexture, textureCoordinate));
    if (segmentsDepth < globeDepth) {
        fragColor = vec4(0.0);
    }
}