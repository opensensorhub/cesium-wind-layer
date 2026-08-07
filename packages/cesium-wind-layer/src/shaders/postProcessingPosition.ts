export const postProcessingPositionFragmentShader = /*glsl*/`#version 300 es
precision highp float;

uniform sampler2D nextParticlesPosition;
uniform sampler2D particlesGenTime;
uniform sampler2D particlesSpeed; // (u, v, norm)

// range (min, max)
uniform vec2 lonRange;
uniform vec2 latRange;

// range (min, max)
uniform vec2 dataLonRange;
uniform vec2 dataLatRange;

uniform float currentTime;
uniform float maxTimeDelta;
uniform float randomCoefficient;

// 添加新的 uniform 变量
uniform bool useViewerBounds;

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
    vec2 range;
    float randomLon, randomLat;
    
    if (useViewerBounds) {
        // 在当前视域范围内生成粒子
        randomLon = randomLongitude(seed, lonRange);
        randomLat = rand(-seed, latRange);
    } else {
        // 在数据范围内生成粒子
        randomLon = randomLongitude(seed, dataLonRange);
        randomLat = rand(-seed, dataLatRange);
    }

    return vec2(randomLon, randomLat);
}

bool longitudeOutside(float lon, float west, float east) {
    if (west <= east) {
        return (lon < west || lon > east) && east - west != 360.0;
    }

    // crosses antimeridian
    return lon < west && lon > east && east - west + 360.0 != 360.0;
}


bool particleOutbound(vec2 particle) {

    float minLat;
    float maxLat;
    float minLon;
    float maxLon;

    if (useViewerBounds) {
        minLat = latRange.x;
        maxLat = latRange.y;
        minLon = lonRange.x;
        maxLon = lonRange.y;
    } else {
        minLat = dataLatRange.x;
        maxLat = dataLatRange.y;
        minLon = dataLonRange.x;
        maxLon = dataLonRange.y;
    }

    return particle.y < minLat ||
           particle.y > maxLat ||
           longitudeOutside(particle.x, minLon, maxLon);
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

    if (deltaTime > particleGenTime.y || particleOutbound(nextParticle)) {
        vec2 randomParticle = generateRandomParticle(seed1);
        fragColor = vec4(randomParticle, 0.0, 1.0); // 1.0 means this is a random particle
    } else {
        fragColor = vec4(nextParticle, 0.0, 0.0);
    }
}
`;
