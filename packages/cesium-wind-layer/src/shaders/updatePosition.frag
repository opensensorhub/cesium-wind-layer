#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D prevParticlesPosition;
uniform sampler2D particlesGenTime;

// range (min, max)
uniform vec2 lonRange;
uniform vec2 latRange;

uniform float randomCoefficient;
uniform float currentTime;

// the size of UV textures: width = lon, height = lat
uniform sampler2D U; // eastward wind
uniform sampler2D V; // northward wind

uniform vec2 speedRange; // (min, max)
uniform vec2 dimension; // (lon, lat)
uniform vec2 minimum; // minimum of each dimension
uniform vec2 maximum; // maximum of each dimension

uniform float speedScaleFactor;
uniform float frameRateAdjustment;
uniform float dropRate;

// pseudo-random generator
const vec3 randomConstants = vec3(12.9898, 78.233, 4375.85453);

in vec2 v_textureCoordinates;

out vec4 fragColor;

float rand(vec2 seed, vec2 range) {
    vec2 randomSeed = randomCoefficient * seed;
    float temp = dot(randomConstants.xy, randomSeed);
    temp = fract(sin(temp) * (randomConstants.z + temp));
    return temp * (range.y - range.x) + range.x;
}

vec2 generateRandomParticle(vec2 seed) {
    return vec2(rand(seed, lonRange), rand(-seed, latRange));
}

vec2 getInterval(vec2 maximum, vec2 minimum, vec2 dimension) {
    return (maximum - minimum) / (dimension - 1.0);
}

vec2 mapPositionToNormalizedIndex2D(vec2 lonLat) {
    // ensure the range of longitude and latitude
    lonLat.x = clamp(lonLat.x, minimum.x, maximum.x);
    lonLat.y = clamp(lonLat.y,  minimum.y, maximum.y);

    vec2 interval = getInterval(maximum, minimum, dimension);
    
    vec2 index2D = vec2(0.0);
    index2D.x = (lonLat.x - minimum.x) / interval.x;
    index2D.y = (lonLat.y - minimum.y) / interval.y;

    vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / dimension.y);
    return normalizedIndex2D;
}

vec2 getWindComponents(vec2 lonLat) {
    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLat);
    float u = texture(U, normalizedIndex2D).r;
    float v = texture(V, normalizedIndex2D).r;
    return vec2(u, v);
}

vec2 calculateSpeedByRungeKutta2(vec2 lonLat) {
    // see https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Second-order_methods_with_two_stages for detail
    float h = 0.5 * speedScaleFactor;

    vec2 y_n = lonLat;
    vec2 f_n = getWindComponents(lonLat);
    vec2 midpoint = y_n + 0.5 * h * f_n;
    vec2 speed = h * getWindComponents(midpoint);

    return speed;
}

vec2 calculateWindNorm(vec2 speed) {
    float speedLength = length(speed.xy);
    bool isSpeedZero = speedLength == 0.0;

    // Clamp speedLength to range
    float clampedSpeed = clamp(speedLength, speedRange.x, speedRange.y);
    float normalizedSpeed = (clampedSpeed - speedRange.x) / (speedRange.y - speedRange.x);
    return vec2(speedLength, normalizedSpeed) * float(!isSpeedZero);
}

void main() {
    vec2 lonLat = texture(prevParticlesPosition, v_textureCoordinates).rg;
    vec2 speedOrigin = getWindComponents(lonLat);
    vec2 speedInLonLat = calculateSpeedByRungeKutta2(lonLat); //* frameRateAdjustment;

    // 计算下一个位置
    vec2 nextParticle = lonLat + speedInLonLat;

    vec2 seed = nextParticle.xy + v_textureCoordinates;

    vec2 particleGenTime = texture(particlesGenTime, v_textureCoordinates).rg;

    float deltaTime = currentTime - particleGenTime.x;
    
    float timeDiff = deltaTime - particleGenTime.y;
    float isNotExpired = float(timeDiff < 0.0);
    float isExpired = float(timeDiff >= 0.0);

    vec2 randomParticle = generateRandomParticle(seed);
    fragColor = isExpired * vec4(randomParticle, 0.0, 1.0); // 1.0 means this is a random particle

    //wrap arround dateline
    nextParticle.x = mod(nextParticle.x + 180.0, 360.0) - 180.0;
    fragColor += isNotExpired * vec4(nextParticle, calculateWindNorm(speedOrigin).y, 0.0);
}