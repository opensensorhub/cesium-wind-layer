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

vec2 projectLonLatToTextureSpace(vec2 lonLat) {
    return (vec2((lonLat.x - lonRange.x)/(lonRange.y - lonRange.x), (lonLat.y - latRange.x)/(latRange.y - latRange.x)) * 2.0) - 1.0;
}

vec3 lonLatToECEF(float sinLon, float cosLon, float sinLat, float cosLat) {
    float a = 6378137.0;
    float b = 6356752.3142;
    float e2 = 6.69437999014e-3;

    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);
    float h = 0.0;
    
    vec3 cartesian;
    cartesian.x = (N_Phi + h) * cosLat * cosLon;
    cartesian.y = (N_Phi + h) * cosLat * sinLon;
    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;
    
    return cartesian;
}

vec2 ecefToLonLat(vec3 ecef) {
    const float e2 = 6.69437999014e-3;
    const float radToDeg = 57.29577951308232; // 180.0 / PI

    float p = length(ecef.xy);

    // Branchless / safe longitude and latitude calculation
    float lonRad = atan(ecef.y, ecef.x);
    float latRad = atan(ecef.z, p * (1.0 - e2));

    return vec2(lonRad * radToDeg, latRad * radToDeg);
}

mat4 createEnuToECEFTransformationMatrix(float sinLon, float cosLon, float sinLat, float cosLat, vec3 origin) {
    //https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates
    //had to change to use 4d matrix for translation
    vec4 e_hat = vec4(-sinLon, cosLon, 0.0, 1.0);
    vec4 n_hat = vec4(-cosLon * sinLat, -sinLon * sinLat, cosLat, 1.0);
    vec4 u_hat = vec4(cosLon * cosLat,  sinLon * cosLat, sinLat, 1.0);

    return mat4(
        e_hat,
        n_hat,
        u_hat,
        vec4(origin, 1.0)
    );
}

vec2 calculateOffsetOnNormalDirection(vec2 pointALonLat, vec2 pointBLonLat, float widthOffset, float lengthOffset) {

    float lon = radians(pointALonLat.x);
    float lat = radians(pointALonLat.y);

    float sinLon = sin(lon);
    float cosLon = cos(lon);
    float sinLat = sin(lat);
    float cosLat = cos(lat);

    vec3 pointA = lonLatToECEF(sinLon, cosLon, sinLat, cosLat);
    vec3 pointB = lonLatToECEF(sinLon, cosLon, sinLat, cosLat);

    mat4 enuToECEF = createEnuToECEFTransformationMatrix(sinLon, cosLon, sinLat, cosLat, pointA);

    float quadWidthMeters = 5000.0;
    float quadLengthMeters = 5000.0;

    //TODO rotate quad to point in direction of particle
    vec4 enuOffset = vec4(widthOffset * quadWidthMeters, lengthOffset * quadLengthMeters, 0.0, 1.0);

    return ecefToLonLat((enuToECEF * enuOffset).xyz);
}

void main() {
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    speed = texture(particlesSpeed, particleIndex);

    vec4 currentPosition = texture(currentParticlesPosition, particleIndex).rgba;
    vec4 nextPosition = texture(postProcessingPosition, particleIndex).rgba;
    
    float isAnyRandomPointUsed = nextPosition.w + currentPosition.w;

    vec2 newLatLon = calculateOffsetOnNormalDirection(currentPosition.xy, nextPosition.xy, normal.y, normal.x);

    bool isCrossingDateline = abs(nextPosition.x - currentPosition.x) > 180.0 || abs(newLatLon.x - currentPosition.x) > 180.0;

    float isDiscard = float(isCrossingDateline || isAnyRandomPointUsed > 0.0);

    gl_Position = vec4(projectLonLatToTextureSpace(newLatLon), 0.0, 1.0) * (1.0/(1.0 - isDiscard));

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
