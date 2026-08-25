import { ShaderSource } from 'cesium';
import { updatePositionShader } from './shaders/updatePosition';
import { calculateSpeedShader } from './shaders/calculateSpeed';
import { postProcessingPositionFragmentShader } from './shaders/postProcessingPosition';
import { renderParticlesFragmentShader, renderParticlesVertexShader } from './shaders/segmentDraw';
import { calculateGenTimeShader } from './shaders/calculateGenTime'
import { renderHeatmapVertexShader, renderHeatmapFragmentShader } from './shaders/HeatmapDraw';
import { renderTrailsFragmentShader, renderTrailsVertexShader } from './shaders/trailsDraw';
import { screenDrawFragmentShader, screenDrawVertexShader } from './shaders/screenDraw';

export class ShaderManager {
  static getCalculateSpeedShader(): ShaderSource {
    return new ShaderSource({
      sources: [calculateSpeedShader]
    });
  }

  static getUpdatePositionShader(): ShaderSource {
    return new ShaderSource({
      sources: [updatePositionShader]
    });
  }

  static getSegmentDrawVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderParticlesVertexShader]
    });
  }

  static getSegmentDrawFragmentShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderParticlesFragmentShader]
    });
  }

  static getPostProcessingPositionShader(): ShaderSource {
    return new ShaderSource({
      sources: [postProcessingPositionFragmentShader]
    });
  }

  static getCalculateGenTimeShader(): ShaderSource {
    return new ShaderSource({
      sources: [calculateGenTimeShader]
    });
  }

  static getHeatmapVertexShader(): ShaderSource {
    return new ShaderSource({
      sources: [renderHeatmapVertexShader]
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
