#version 300 es
precision highp float;

in vec2 st;
in vec4 position;

out vec2 texCoord;

void main() {
    gl_Position = czm_modelViewProjection * position;
    texCoord = st;
}