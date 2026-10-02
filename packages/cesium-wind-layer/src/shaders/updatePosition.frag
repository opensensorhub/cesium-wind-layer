#version 300 es
precision highp float;

uniform sampler2D prevParticlesPosition;

// range (min, max)
uniform vec2 lonRange;
uniform vec2 latRange;

uniform float randomCoefficient;
uniform float deltaTime;
uniform float minParticleTTL;
uniform float maxParticleTTL;

// the size of UV textures: width = lon, height = lat
uniform sampler2D UV;

uniform vec2 speedRange; // (min, max)
uniform vec2 dimension; // (lon, lat)
uniform vec2 minimum; // minimum of each dimension
uniform vec2 maximum; // maximum of each dimension

uniform float speedScaleFactor;

// pseudo-random generator
const vec3 randomConstants = vec3(12.9898f, 78.233f, 4375.85453f);

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
  return (maximum - minimum) / (dimension - 1.0f);
}

vec2 mapPositionToNormalizedIndex2D(vec2 lonLat) {
  // ensure the range of longitude and latitude
  lonLat.x = clamp(lonLat.x, minimum.x, maximum.x);
  lonLat.y = clamp(lonLat.y, minimum.y, maximum.y);

  vec2 interval = getInterval(maximum, minimum, dimension);

  vec2 index2D = vec2(0.0f);
  index2D.x = (lonLat.x - minimum.x) / interval.x;
  index2D.y = (lonLat.y - minimum.y) / interval.y;

  vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / dimension.y);
  return normalizedIndex2D;
}

vec4 getWindComponents(vec2 lonLat) {
  vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLat);
  return texture(UV, normalizedIndex2D).rgba;
}

vec2 calculateSpeedByRungeKutta2(vec2 y_n, vec2 f_n) {
    // see https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Second-order_methods_with_two_stages for detail
  float h = 0.5f * speedScaleFactor;
  vec2 midpoint = y_n + 0.5f * h * f_n;

  return h * getWindComponents(midpoint).xy;
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
  return particle.y < latRange.x || particle.y > latRange.y || ((lonRange.x > -180.0f || lonRange.y < 180.0f) && (particle.x < lonRange.x || particle.x > lonRange.y));
}

void main() {
  vec4 prevParticle = texture(prevParticlesPosition, v_textureCoordinates).rgba;
  vec2 lonLat = prevParticle.xy;
  vec4 windComponents = getWindComponents(lonLat).xyzw;
  vec2 speedOriginLL = windComponents.xy;
  vec2 speedOrigin = windComponents.zw;
  vec2 speedInLonLat = calculateSpeedByRungeKutta2(lonLat, speedOriginLL);

  // 计算下一个位置
  vec2 nextParticle = lonLat + speedInLonLat;
  
  float ttl = abs(prevParticle.a) - deltaTime;
  if(ttl <= 0.0f || particleOutbound(nextParticle)) {
    vec2 seed = nextParticle.xy + v_textureCoordinates;
    vec2 randomParticle = generateRandomParticle(seed);
    float randTime = rand(randomParticle + v_textureCoordinates, vec2(minParticleTTL, maxParticleTTL));
    fragColor = vec4(randomParticle, 0.0f, -randTime);
  } else {
    //wrap arround dateline
    nextParticle.x = mod(nextParticle.x + 180.0f, 360.0f) - 180.0f;
    fragColor = vec4(nextParticle, calculateWindNorm(speedOrigin).y, ttl);
  }
}