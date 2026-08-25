export const renderParticlesVertexShader = /*glsl*/`#version 300 es
precision highp float;

in vec2 st;
in vec3 normal;

uniform sampler2D previousParticlesPosition;
uniform sampler2D currentParticlesPosition;
uniform sampler2D postProcessingPosition;
uniform sampler2D particlesSpeed;
uniform sampler2D particlesGenTime;

uniform float currentTime;
uniform float particleFadeInTime;
uniform float particleFadeOutTime;
uniform float frameRateAdjustment;
uniform float particleHeight;
uniform float aspect;
uniform float pixelSize;
uniform vec2 lineWidth;
uniform vec2 lineLength;
uniform vec2 domain;
uniform bool is3D;
uniform vec2 latRange;
uniform vec2 lonRange;

// 添加输出变量传递给片元着色器
out vec4 speed;
out float timeAlpha;

//https://en.wikipedia.org/wiki/Hann_function
//https://www.desmos.com/calculator/ar8uhyf9ir
float fadeIn(float x, float L, float f0) {
    return 0.5 - (0.5 * cos((czm_pi*x)/f0));
}

float fadeOut(float x, float L, float f1) {
    return 0.5 - (0.5 * cos(((czm_pi*x)/f1) - ((czm_pi*(L-(2.0*f1)))/f1)));
}

float hannFade(float x, float f0, float f1, float L) {
    return float(x > 0.0 && x <= f0) * fadeIn(x, L, f0) + float(x > f0 && x <=  L - f1) + float(x > L-f1 && x <= L) * fadeOut(x, L, f1);
}

vec2 projectLonLat(vec2 lonLat) {
    return (vec2((lonLat.x - lonRange.x)/(lonRange.y - lonRange.x), (lonLat.y - latRange.x)/(latRange.y - latRange.x)) * 2.0) - 1.0;
}

vec2 calculateOffsetOnNormalDirection(vec2 pointA, vec2 pointB, float widthOffset, float lengthOffset) {
    
    vec2 direction = pointB - pointA;
    vec2 normalizedDirection = normalize(direction);
    vec2 normalVector = vec2(-normalizedDirection.y, normalizedDirection.x);

    float quadWidth = 0.07;
    float quadLength = 0.12;

    return (normalizedDirection * lengthOffset * quadLength) + (normalVector * widthOffset * quadWidth);
}

void main() {
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    speed = texture(particlesSpeed, particleIndex);

    vec4 currentPosition = texture(currentParticlesPosition, particleIndex).rgba;
    vec4 nextPosition = texture(postProcessingPosition, particleIndex).rgba;
    
    float isAnyRandomPointUsed = nextPosition.w + currentPosition.w;

    vec2 rotatedOffset = calculateOffsetOnNormalDirection(currentPosition.xy, nextPosition.xy, normal.y, normal.x);

    vec2 newLatLon = currentPosition.xy + rotatedOffset;

    gl_Position = vec4(projectLonLat(newLatLon), float(gl_InstanceID), 1.0);

    gl_Position.x += isAnyRandomPointUsed * 3.0;

    vec2 particleGenTime = texture(particlesGenTime, particleIndex).rg;

    float delta = currentTime - particleGenTime.x;
    timeAlpha = hannFade(delta, particleFadeInTime, particleFadeOutTime, particleGenTime.y);
}
`;

export const renderParticlesFragmentShader = /*glsl*/`#version 300 es
precision highp float;

in vec4 speed;
in float timeAlpha;
//in float v_segmentPosition;
//in float timeAlpha;

uniform vec2 domain;
uniform vec2 displayRange;
uniform sampler2D colorTable;
uniform sampler2D segmentsDepthTexture;
//uniform bool useHeatmap;

out vec4 fragColor;

void main() {
    float inRange = float(speed.a > 0.0 && speed.b > displayRange.x && speed.b < displayRange.y);
    float speedLength = clamp(speed.b, domain.x, domain.y);
    float normalizedSpeed = (speedLength - domain.x) / (domain.y - domain.x);
    vec4 baseColor = texture(colorTable, vec2(normalizedSpeed, 0.0));

    // 组合颜色和透明度
    fragColor = vec4(baseColor.rgb * inRange, inRange * timeAlpha);
}
`;
