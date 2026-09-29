#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D prevParticlesPosition;
uniform sampler2D particlesGenTime;

// range (min, max)
uniform vec2 lonRange;
uniform vec2 latRange;

uniform vec2 displayLonRange;
uniform vec2 displayLatRange;

uniform float randomCoefficient;
uniform float currentTime;

// the size of UV textures: width = lon, height = lat
uniform sampler2D U; // eastward wind deg/s
uniform sampler2D V; // northward wind deg/s
uniform sampler2D u_ms; // eastward wind m/s
uniform sampler2D v_ms; // northward wind m/s

uniform vec2 speedRange; // (min, max)
uniform vec2 dimension; // (lon, lat)
uniform vec2 minimum; // minimum of each dimension
uniform vec2 maximum; // maximum of each dimension

uniform float speedScaleFactor;

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
    return vec2(rand(seed, displayLonRange), rand(-seed, displayLatRange));
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

vec4 getWindComponents(vec2 lonLat) {
    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLat);
    float u = texture(U, normalizedIndex2D).r;
    float v = texture(V, normalizedIndex2D).r;
    float u_raw = texture( u_ms, normalizedIndex2D).r;
    float v_raw = texture( v_ms, normalizedIndex2D).r;
    return vec4(u, v, u_raw, v_raw);
}

vec2 calculateSpeedByRungeKutta2(vec2 lonLat) {
    // see https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Second-order_methods_with_two_stages for detail
    float h = 0.5 * speedScaleFactor;

    vec2 y_n = lonLat;
    vec2 f_n = getWindComponents(lonLat).xy;
    vec2 midpoint = y_n + 0.5 * h * f_n;
    vec2 speed = h * getWindComponents(midpoint).xy;

    return speed;
}

vec2 calculateWindNorm(vec2 speed) {
    float speedLength = length(speed.xy);
    //bool isSpeedZero = speedLength == 0.0;

    // Clamp speedLength to range
    float clampedSpeed = clamp(speedLength, speedRange.x, speedRange.y);
    float normalizedSpeed = (clampedSpeed - speedRange.x) / (speedRange.y - speedRange.x);
    return vec2(speedLength, normalizedSpeed); //* float(!isSpeedZero);
}

bool particleOutbound(vec2 particle) {
    return particle.y < displayLatRange.x || particle.y > displayLatRange.y || ((displayLonRange.x > -180.0 || displayLonRange.y < 180.0) && (particle.x < displayLonRange.x || particle.x > displayLonRange.y));
}

void main() {
    vec2 lonLat = texture(prevParticlesPosition, v_textureCoordinates).rg;
    vec2 speedOrigin = getWindComponents(lonLat).zw;
    vec2 speedInLonLat = calculateSpeedByRungeKutta2(lonLat); //* frameRateAdjustment;

    // 计算下一个位置
    vec2 nextParticle = lonLat + speedInLonLat;

    vec2 seed = nextParticle.xy + v_textureCoordinates;

    vec2 particleGenTime = texture(particlesGenTime, v_textureCoordinates).rg;

    float deltaTime = currentTime - particleGenTime.x;
    
    float timeDiff = deltaTime - particleGenTime.y;
    bool isExpired = timeDiff >= 0.0 || particleOutbound(nextParticle);

    vec2 randomParticle = generateRandomParticle(seed);
    fragColor = float(isExpired) * vec4(randomParticle, 0.0, 1.0); // 1.0 means this is a random particle

    //wrap arround dateline
    nextParticle.x = mod(nextParticle.x + 180.0, 360.0) - 180.0;
    fragColor += float(!isExpired) * vec4(nextParticle, calculateWindNorm(speedOrigin).y, 0.0);
}