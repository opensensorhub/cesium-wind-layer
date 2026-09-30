#version 300 es
precision highp float;
precision highp sampler3D;

in float normal;

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
    int particleTextureSize = textureSize(particlesPosition, 0).x;
    int segmentStep = gl_VertexID / 2;
    ivec2 particleIndex = ivec2(gl_InstanceID % particleTextureSize, gl_InstanceID / particleTextureSize);
    int iNumLayers = int(numLayers);
    int iCurrentLayer = int(currentLayer);
    int currentLayerIndex = (iCurrentLayer + segmentStep) % iNumLayers;
    bool isHead = segmentStep == iNumLayers - 1;
    //if current vertex maps to head of trail, use previous pos
    //this avoids vector pointing to tail
    int nextLayerIndex = (currentLayerIndex + (isHead ? iNumLayers - 1 : 1)) % iNumLayers;

    vec4 nextPosition = texelFetch(particlesPosition, ivec3(particleIndex, nextLayerIndex), 0).rgba;
    vec4 currentPosition = texelFetch(particlesPosition, ivec3(particleIndex, currentLayerIndex), 0).rgba;
    float isAnyRandomPointUsed = restoreFloatAndBit(nextPosition.w, 31u).x + restoreFloatAndBit(currentPosition.w, 31u).x;

    if(isAnyRandomPointUsed > 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, -1.0);
    } else {

        speed = restoreFloatAndBit(currentPosition.w, 31u).y;

        float widthFactor = mix(lineWidth.x, lineWidth.y, speed);

        gl_Position = calculateOffsetOnNormalDirection(
            currentPosition.xyz, 
            nextPosition.xyz, 
            normal * widthFactor * (isHead ? -1.0 : 1.0) //vector direction reversed for head case
        );
    }

    alpha = float(segmentStep) / numLayers;
}