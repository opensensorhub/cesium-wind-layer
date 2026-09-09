#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D currentParticlePositions;

in vec2 v_textureCoordinates;

out vec4 fragColor;

void main() {
    fragColor = texture(currentParticlePositions, v_textureCoordinates);
}