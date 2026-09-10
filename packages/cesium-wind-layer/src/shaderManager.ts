import { ShaderSource } from 'cesium';
import updatePosition from './shaders/updatePosition.frag';
import segmentDrawFrag from './shaders/segmentDraw.frag';
import segmentDrawVert from './shaders/segmentDraw.vert';
import renderHeatmapFragmentShader from './shaders/heatmapDraw.frag';
import screenDrawVertexShader from './shaders/screenDraw.vert';
import ViewportQuad from './shaders/ViewportQuad.vert'
import copyPositions from './shaders/copyPositions.frag'

export class ShaderManager {

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

  static getViewportQuadVS(): ShaderSource {
    return new ShaderSource({
      sources: [ViewportQuad]
    });
  }

  static getCopyPositions(): ShaderSource {
    return new ShaderSource({
      sources: [copyPositions]
    });
  }
}
