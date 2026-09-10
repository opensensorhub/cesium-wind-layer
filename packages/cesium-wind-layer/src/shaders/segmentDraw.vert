#version 300 es
precision highp float;
precision highp sampler3D;

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

uniform sampler3D particlesPosition;

uniform float currentLayer;
uniform float numLayers;
uniform vec2 lineWidth;

// 添加输出变量传递给片元着色器
out float speed;
out float alpha;
out vec2 textureCoordinate;

vec3 lonLatToECEF(float sinLon, float cosLon, float sinLat, float cosLat) {
    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);
    float h = 0.0; // it should be high enough otherwise the particle may not pass the terrain depth test
    vec3 cartesian = vec3(0.0);
    cartesian.x = (N_Phi + h) * cosLat * cosLon;
    cartesian.y = (N_Phi + h) * cosLat * sinLon;
    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;
    return cartesian;
}

//https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates
mat3 createEnuToECEFRot(float sinLon, float cosLon, float sinLat, float cosLat) {
    vec3 e = vec3(-sinLon, cosLon, 0.0);
    vec3 n = vec3(-cosLon * sinLat, -sinLon * sinLat, cosLat);
    vec3 u = vec3(cosLon * cosLat, sinLon * cosLat, sinLat);

    return mat3(e, n, u);
}

vec3 calculateOffsetOnNormalDirection(vec2 pointALonLat, vec2 pointBLonLat, float widthOffset, float normalizedSpeed) {
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

    //get head and side vector of quad
    vec2 length = normalize(pointBEnu - pointAEnu).xy;
    vec2 width = vec2(-length.y, length.x);

    float quadWidthMeters = mix(lineWidth.x, lineWidth.y, normalizedSpeed);

    vec3 offsetEnu = vec3((width * widthOffset * quadWidthMeters), 0.0);

    return pointA + (enuToEcefRot * offsetEnu);
}

void main() {
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    float segmentStep = normal.y;
    float currentLayerIndex = mod(currentLayer + 1.0 + segmentStep, numLayers);
    float nextLayerIndex = mod(currentLayer + 1.0 + segmentStep + 1.0, numLayers);
    float currentZ = (currentLayerIndex + 0.5) / numLayers;
    float nextZ = (nextLayerIndex + 0.5) / numLayers;

    vec4 currentPosition = texture(particlesPosition, vec3(particleIndex, currentZ)).rgba;
    vec4 nextPosition = texture(particlesPosition, vec3(particleIndex, nextZ)).rgba;

    float isAnyRandomPointUsed = nextPosition.w;
    bool isInvalid = (isAnyRandomPointUsed > 0.0) || (segmentStep == numLayers - 1.0);

    vec3 newPos = calculateOffsetOnNormalDirection(
        currentPosition.xy, 
        nextPosition.xy, 
        normal.x, 
        currentPosition.z
    );


    gl_Position = (float(!isInvalid) * czm_modelViewProjection * vec4(newPos, 1.0)) + (float(isInvalid) * vec4(0.0, 0.0, 0.0, -1.0));

    // Alpha fades nicely from tail (0.0) to head (1.0)
    alpha = segmentStep / numLayers;
    textureCoordinate = st;
    speed = currentPosition.z;
}