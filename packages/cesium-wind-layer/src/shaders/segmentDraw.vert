#version 300 es
precision highp float;

in vec2 st;
in vec3 normal;

#ifndef czm_pi
#define czm_pi 3.141592653589793
#endif

#ifndef a
#define a 6378137.0
#endif

#ifndef b
#define b 6356752.3142
#endif

#ifndef e2
#define e2 6.69437999014e-3
#endif

uniform sampler2D currentParticlesPosition;
uniform sampler2D postProcessingPosition;
uniform sampler2D particlesSpeed;
uniform sampler2D particlesGenTime;

uniform float currentTime;
uniform float particleFadeInTime;
uniform float particleFadeOutTime;
uniform vec2 lineWidth;
uniform vec2 domain;
uniform bool is3D;
uniform vec2 latRange;
uniform vec2 lonRange;

// 添加输出变量传递给片元着色器
out vec4 speed;
out float timeAlpha;

float normalizeMinMax(float val, float min, float max) {
    return (val - min)/(max - min);
}

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
    return (vec2(normalizeMinMax(lonLat.x, lonRange.x, lonRange.y), normalizeMinMax(lonLat.y, latRange.x, latRange.y)) * 2.0) - 1.0;
}

vec3 lonLatToECEF(float sinLon, float cosLon, float sinLat, float cosLat) {
    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);
    float h = 0.0;
    
    vec3 cartesian;
    cartesian.x = (N_Phi + h) * cosLat * cosLon;
    cartesian.y = (N_Phi + h) * cosLat * sinLon;
    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;
    
    return cartesian;
}

//https://hal.science/hal-01704943v2/document
vec2 ecefToLonLat(vec3 ecef) {

    float one_third = 1.0/3.0;
    float a2 = a*a;
    float w2 = dot(ecef.xy, ecef.xy);
    float l = e2/2.0;
    float l2 = l*l;
    float m = w2/a2;
    float n = pow(((1.0-e2)* ecef.z)/b, 2.0);
    float p = (m + n - (4.0 * l2))/6.0;
    float G = m * n * l2;
    float H = (2.0 * p * p * p) + G;
    float C = pow(H + G + (2.0 * sqrt(H*G)), one_third)/pow(2.0, one_third);
    float i = -((2.0*l2) + m + n)/2.0;
    float P = p * p;
    float B = (i/3.0) - C - (P/C);
    float k = l2*(l2 - m - n);
    float t = sqrt(sqrt((B*B) - k) - ((B+i)/2.0)) - (sign(m-n) * sqrt(abs((B-i)/2.0)));
    float F = (t*t*t*t) + (2.0*i*t*t) + (2.0 * l * (m-n) * t) + k;
    float Dfdt = (4.0*t*t*t) + (4.0*i*t) + (2.0*l*(m-n));
    float delta_t = -F/Dfdt;
    float u = t + delta_t + l;
    float v = t + delta_t - l;
    float w = sqrt(w2);


    float latRad = atan(ecef.z*u, w*v);
    float lonRad = atan(ecef.y, ecef.x);

    return vec2(degrees(lonRad), degrees(latRad));
}

//https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates
mat3 createEnuToECEFRot(float sinLon, float cosLon, float sinLat, float cosLat) {
    vec3 e = vec3(-sinLon, cosLon, 0.0);
    vec3 n = vec3(-cosLon * sinLat, -sinLon * sinLat, cosLat);
    vec3 u = vec3(cosLon * cosLat, sinLon * cosLat, sinLat);

    return mat3(e, n, u);
}

vec2 calculateOffsetOnNormalDirection(vec2 pointALonLat, vec2 pointBLonLat, float widthOffset, float lengthOffset, float normalizedSpeed) {
    float lonA = radians(pointALonLat.x);
    float latA = radians(pointALonLat.y);
    float lonB = radians(pointBLonLat.x);
    float latB = radians(pointBLonLat.y);

    float sinLonA = sin(lonA);
    float cosLonA = cos(lonA);
    float sinLatA = sin(latA);
    float cosLatA = cos(latA);

    vec3 pointA = lonLatToECEF(sinLonA, cosLonA, sinLatA, cosLatA);
    vec3 pointB = lonLatToECEF(sin(lonB), cos(lonB), sin(latB), cos(latB));

    // create rotation matrices to convert ecef -> enu and vice versa
    // up vector will match vector A in this case
    //tangent plane runs through origin in ECEF coords
    mat3 enuToEcefRot = createEnuToECEFRot(sinLonA, cosLonA, sinLatA, cosLatA);
    mat3 ecefToEnuRot = transpose(enuToEcefRot);

    //do vector rotations
    vec3 pointAEnu = ecefToEnuRot * pointA;
    vec3 pointBEnu = ecefToEnuRot * pointB;

    float dist = distance(pointA, pointB);

    //get head and side vector of quad
    vec2 length = normalize(pointBEnu - pointAEnu).xy;
    vec2 width = vec2(-length.y, length.x);

    float quadWidthMeters = mix(lineWidth.x, lineWidth.y, normalizedSpeed);
    float quadLengthMeters = dist/2.0;

    vec3 offsetEnu = vec3((width * widthOffset * quadWidthMeters) + (length * lengthOffset * quadLengthMeters), 0.0);

    return ecefToLonLat(pointA + (enuToEcefRot * offsetEnu));
}

void main() {
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    speed = texture(particlesSpeed, particleIndex);

    vec4 currentPosition = texture(currentParticlesPosition, particleIndex).rgba;
    vec4 nextPosition = texture(postProcessingPosition, particleIndex).rgba;
    
    float isAnyRandomPointUsed = nextPosition.w + currentPosition.w;

    vec2 newLatLon = calculateOffsetOnNormalDirection(currentPosition.xy, nextPosition.xy, normal.y, normal.x, speed.w);

    bool isCrossingDateline = abs(nextPosition.x - currentPosition.x) > 180.0 || abs(newLatLon.x - currentPosition.x) > 180.0;

    float isDiscard = float(isCrossingDateline || isAnyRandomPointUsed > 0.0);

    gl_Position = vec4(projectLonLatToTextureSpace(newLatLon), 0.0, 1.0) * (1.0/(1.0 - isDiscard)); //returns NaN and discards triangle if marked to be discarded

    vec2 particleGenTime = texture(particlesGenTime, particleIndex).rg;

    float delta = currentTime - particleGenTime.x;
    timeAlpha = hannFade(delta, particleFadeInTime, particleFadeOutTime, particleGenTime.y);
}