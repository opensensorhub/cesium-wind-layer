#version 300 es

in vec4 position;
in vec2 st;

out vec2 v_textureCoordinates;

void main() 
{
    gl_Position = position;
    v_textureCoordinates = st;
}