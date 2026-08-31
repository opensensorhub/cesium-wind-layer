#version 300 es

precision highp float;

// the size of UV textures: width = lon, height = lat
uniform sampler2D U; // eastward wind
uniform sampler2D V; // northward wind
uniform sampler2D currentParticlesPosition; // (lon, lat, lev)

uniform vec2 uRange; // (min, max)
uniform vec2 vRange; // (min, max)
uniform vec2 speedRange; // (min, max)
uniform vec2 dimension; // (lon, lat)
uniform vec2 minimum; // minimum of each dimension
uniform vec2 maximum; // maximum of each dimension

uniform float speedScaleFactor;
uniform float frameRateAdjustment;

in vec2 v_textureCoordinates;

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

vec2 lengthOfLonLat(vec2 lonLat) {
    // unit conversion: meters -> longitude latitude degrees
    // see https://en.wikipedia.org/wiki/Geographic_coordinate_system#Length_of_a_degree for detail

    // Calculate the length of a degree of latitude and longitude in meters
    float latitude = radians(lonLat.y);

    float term1 = 111132.92;
    float term2 = 559.82 * cos(2.0 * latitude);
    float term3 = 1.175 * cos(4.0 * latitude);
    float term4 = 0.0023 * cos(6.0 * latitude);
    float latLength = term1 - term2 + term3 - term4;

    float term5 = 111412.84 * cos(latitude);
    float term6 = 93.5 * cos(3.0 * latitude);
    float term7 = 0.118 * cos(5.0 * latitude);
    float longLength = term5 - term6 + term7;

    return vec2(longLength, latLength);
}

vec2 convertSpeedUnitToLonLat(vec2 lonLat, vec2 speed) {
    vec2 lonLatLength = lengthOfLonLat(lonLat);
    float u = speed.x / lonLatLength.x;
    float v = speed.y / lonLatLength.y;
    vec2 windVectorInLonLat = vec2(u, v);

    return windVectorInLonLat;
}

vec2 calculateSpeedByRungeKutta2(vec2 lonLat) {
    // see https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Second-order_methods_with_two_stages for detail
    const float h = 0.5;

    vec2 y_n = lonLat;
    vec2 f_n = getWindComponents(lonLat);
    vec2 midpoint = y_n + 0.5 * h * convertSpeedUnitToLonLat(y_n, f_n) * speedScaleFactor;
    vec2 speed = h * getWindComponents(midpoint) * speedScaleFactor;

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

out vec4 fragColor;

void main() {
    // texture coordinate must be normalized
    vec2 lonLat = texture(currentParticlesPosition, v_textureCoordinates).rg;
    vec2 speedOrigin = getWindComponents(lonLat);
    vec2 speed = calculateSpeedByRungeKutta2(lonLat) * frameRateAdjustment;
    vec2 speedInLonLat = convertSpeedUnitToLonLat(lonLat, speed);

    fragColor = vec4(speedInLonLat, calculateWindNorm(speedOrigin));
}