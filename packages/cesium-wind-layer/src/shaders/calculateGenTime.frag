#version 300 es

precision highp float;

uniform float currentTime;
uniform sampler2D currentParticlesPosition;
uniform sampler2D prevParticlesGenTime;
uniform float particleLifeTime;
uniform float randomCoefficient;

in vec2 v_textureCoordinates;

out vec4 fragColor;

const vec3 randomConstants = vec3(12.9898, 78.233, 4375.85453);

float rand(vec2 seed, vec2 range) {
    vec2 randomSeed = randomCoefficient * seed;
    float temp = dot(randomConstants.xy, randomSeed);
    temp = fract(sin(temp) * (randomConstants.z + temp));
    return temp * (range.y - range.x) + range.x;
}

void main() {
    vec4 currentParticlePosition = texture(currentParticlesPosition, v_textureCoordinates).rgba;
    vec2 prevGenTime = texture(prevParticlesGenTime, v_textureCoordinates).rg;

    vec2 seed = currentParticlePosition.xy + v_textureCoordinates;

    float isRandom = currentParticlePosition.w;

    //random offset is applied to particle life time to avoid lockstep fading
    //offset up to 1000ms
    float timeOffset = rand(seed, vec2(0.0, 1000.0));
    fragColor = float(isRandom > 0.0) * vec4(currentTime + timeOffset, particleLifeTime + timeOffset, 0.0, 0.0) + float(isRandom <= 0.0) * vec4(prevGenTime.x, prevGenTime.y, 0.0, 0.0); 
}
