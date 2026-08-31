export const postProcessingPositionFragmentShader = /*glsl*/`#version 300 es
precision highp float;

uniform sampler2D nextParticlesPosition;
uniform sampler2D particlesGenTime;
uniform sampler2D particlesSpeed; // (u, v, norm)

// range (min, max)
uniform vec2 lonRange;
uniform vec2 latRange;

uniform float currentTime;
uniform float maxTimeDelta;
uniform float randomCoefficient;

in vec2 v_textureCoordinates;

// pseudo-random generator
const vec3 randomConstants = vec3(12.9898, 78.233, 4375.85453);
const vec2 normalRange = vec2(0.0, 1.0);
float rand(vec2 seed, vec2 range) {
    vec2 randomSeed = randomCoefficient * seed;
    float temp = dot(randomConstants.xy, randomSeed);
    temp = fract(sin(temp) * (randomConstants.z + temp));
    return temp * (range.y - range.x) + range.x;
}

float randomLongitude(vec2 seed, vec2 range)
{
    float r = rand(seed, vec2(0.0, 1.0));

    if (range.x <= range.y) {
        return mix(range.x, range.y, r);
    }

    // crosses antimeridian
    float lon = mix(range.x, range.y + 360.0, r);

    if (lon > 180.0) {
        lon -= 360.0;
    }

    return lon;
}

vec2 generateRandomParticle(vec2 seed) {
    return vec2(randomLongitude(seed, lonRange), rand(-seed, latRange));
}

out vec4 fragColor;

void main() {
    vec2 nextParticle = texture(nextParticlesPosition, v_textureCoordinates).rg;
    vec4 nextSpeed = texture(particlesSpeed, v_textureCoordinates);
    vec2 particleGenTime = texture(particlesGenTime, v_textureCoordinates).rg;

    float deltaTime = currentTime - particleGenTime.x;
    float speedNorm = nextSpeed.a;

    vec2 seed1 = nextParticle.xy + v_textureCoordinates;
    vec2 seed2 = nextSpeed.rg + v_textureCoordinates;
    
    float randomNumber = rand(seed2, normalRange);
    float timeDiff = deltaTime - particleGenTime.y;
    float isNotExpired = float(timeDiff < 0.0);
    float isExpired = float(timeDiff >= 0.0);


    vec2 randomParticle = generateRandomParticle(seed1);
    fragColor = isExpired * vec4(randomParticle, 0.0, 1.0); // 1.0 means this is a random particle

    //wrap arround dateline
    nextParticle.x = mod(nextParticle.x + 180.0, 360.0) - 180.0;
    fragColor += isNotExpired * vec4(nextParticle, 0.0, 0.0);
}
`;
