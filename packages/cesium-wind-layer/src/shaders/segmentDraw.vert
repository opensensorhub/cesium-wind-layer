#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 st;
in vec2 normal;

#ifndef czm_pi
#define czm_pi 3.141592653589793
#endif

uniform sampler3D particlesPosition;

uniform float currentLayer;
uniform float numLayers;
uniform float aspect;
uniform vec2 lineWidth;

// 添加输出变量传递给片元着色器
out float speed;
out float alpha;

vec4 calculateOffsetOnNormalDirection(vec3 pointAECEF, vec3 pointBECEF, float widthOffset) {

    vec4 pointA = czm_modelViewProjection * vec4(pointAECEF, 1.0);
    vec4 pointB = czm_modelViewProjection * vec4(pointBECEF, 1.0);

    // create rotation matrices to convert ecef -> enu and vice versa
    // up vector will match vector A in this case
    //tangent plane runs through origin in ECEF coords
    //mat3 enuToEcefRot = createEnuToECEFRot(sinLonA, cosLonA, sinLatA, cosLatA);
    //mat3 ecefToEnuRot = transpose(enuToEcefRot);

    //get head and side vector of quad

    vec2 aspectVec2 = vec2(aspect, 1.0);
    vec2 pointA_XY = (pointA.xy / pointA.w) * aspectVec2;
    vec2 pointB_XY = (pointB.xy / pointB.w) * aspectVec2;

    vec2 direction = normalize(pointB_XY - pointA_XY);
    vec2 normalVector = vec2(-direction.y, direction.x);
    normalVector.x = normalVector.x / aspect;

    return pointA + vec4(10000.0 * normalVector * widthOffset, 0.0, 0.0);
}

vec2 restoreFloatAndBit(float modifiedNumber, uint bitIndex) {
    uint uModified = floatBitsToUint(modifiedNumber);
    uint bitState = (uModified >> bitIndex) & 1u;
    uint uOriginal = uModified & ~(1u << bitIndex);

    return vec2(float(bitState), uintBitsToFloat(uOriginal));
}

void main() {
    vec2 particleIndex = vec2(st.x, 1.0 - st.y);
    float segmentStep = normal.y;
    float currentLayerIndex = mod(currentLayer + segmentStep + 1.0, numLayers);
    float nextLayerIndex = mod(currentLayer + segmentStep + 2.0, numLayers);
    float currentZ = (currentLayerIndex + 0.5) / numLayers;
    float nextZ = (nextLayerIndex + 0.5) / numLayers;

    vec4 nextPosition = texture(particlesPosition, vec3(particleIndex, nextZ)).rgba;

    float isAnyRandomPointUsed = restoreFloatAndBit(nextPosition.w, 31u).x;

    if((isAnyRandomPointUsed > 0.0) || (segmentStep == numLayers - 1.0)) {
        gl_Position = vec4(0.0, 0.0, 0.0, -1.0);
    } else {
        vec4 currentPosition = texture(particlesPosition, vec3(particleIndex, currentZ)).rgba;

        speed = restoreFloatAndBit(currentPosition.w, 31u).y;

        float widthFactor = mix(lineWidth.x, lineWidth.y, speed);

        gl_Position = calculateOffsetOnNormalDirection(
            currentPosition.xyz, 
            nextPosition.xyz, 
            normal.x * widthFactor
        );
    }

    alpha = segmentStep / numLayers;
}