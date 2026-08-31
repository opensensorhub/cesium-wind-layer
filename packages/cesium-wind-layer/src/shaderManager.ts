import { ShaderSource } from 'cesium';
import updatePosition from './shaders/updatePosition.frag';
import calculateSpeed  from './shaders/calculateSpeed.frag';
import postProcessingPosition from './shaders/postProcessingPosition.frag';
import segmentDrawFrag from './shaders/segmentDraw.frag';
import segmentDrawVert from './shaders/segmentDraw.vert';
import calculateGenTime from './shaders/calculateGenTime.frag'
import renderHeatmapFragmentShader from './shaders/HeatmapDraw.frag';
import renderTrailsFragmentShader from './shaders/trailsDraw.frag';
import renderTrailsVertexShader from './shaders/trailsDraw.vert';
import screenDrawFragmentShader from './shaders/screenDraw.frag';
import screenDrawVertexShader from './shaders/screenDraw.vert';

export class ShaderManager {
  static getCalculateSpeedShader(): ShaderSource {
    return new ShaderSource({
      sources: [calculateSpeed]
    });
  }

  static getUpdatePositionShader(): ShaderSource {
    return new ShaderSource({
      sources: [updatePosition]
    });
  }

  static getSegmentDrawVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [segmentDrawVert]
    });
  }

  static getSegmentDrawFragmentShader(): ShaderSource {
    return new ShaderSource({
      sources: [segmentDrawFrag]
    });
  }

  static getPostProcessingPositionShader(): ShaderSource {
    return new ShaderSource({
      sources: [postProcessingPosition]
    });
  }

  static getCalculateGenTimeShader(): ShaderSource {
    return new ShaderSource({
      sources: [calculateGenTime]
    });
  }

  static getHeatmapVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [screenDrawVertexShader]
    });
  }

  static getHeatmapFragmentShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderHeatmapFragmentShader]
    });
  }

  static getTrailsDrawVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderTrailsVertexShader]
    });
  }

  static getTrailsDrawFragmentShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderTrailsFragmentShader]
    });
  }

  static getScreenDrawVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [screenDrawVertexShader]
    });
  }

  static getScreenDrawFragmentShader(): ShaderSource {
    return new ShaderSource({
      sources: [screenDrawFragmentShader]
    });
  }
}
