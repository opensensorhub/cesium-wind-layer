#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D currentParticlePositions;
uniform float particleHeight;
uniform float particleLifeTime;

in vec2 v_textureCoordinates;

out vec4 fragColor;

#ifndef a
#define a 6378137.0
#endif

#ifndef b
#define b 6356752.3142
#endif

#ifndef e2
#define e2 6.69437999014e-3
#endif

vec3 lonLatToECEF(float sinLon, float cosLon, float sinLat, float cosLat) {
    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);
    float h = particleHeight; // it should be high enough otherwise the particle may not pass the terrain depth test
    vec3 cartesian = vec3(0.0);
    cartesian.x = (N_Phi + h) * cosLat * cosLon;
    cartesian.y = (N_Phi + h) * cosLat * sinLon;
    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;
    return cartesian;
}

float setFloatBitToValue(float number, uint bitIndex, float bitValue) {
    uint uValue = floatBitsToUint(number);
    uValue &= ~(1u << bitIndex);
    uint maskBit = uint(clamp(ceil(abs(bitValue)), 0.0, 1.0));
    uValue |= (maskBit << bitIndex);
    
    return uintBitsToFloat(uValue);
}

void main() {

    vec4 position = texture(currentParticlePositions, v_textureCoordinates).rgba;

    float lon = radians(position.x);
    float lat = radians(position.y);

    float sinLon = sin(lon);
    float cosLon = cos(lon);
    float sinLat = sin(lat);
    float cosLat = cos(lat);

    fragColor = vec4(lonLatToECEF(sinLon, cosLon, sinLat, cosLat), setFloatBitToValue(position.z, 31u, float(position.w >= particleLifeTime)));
}