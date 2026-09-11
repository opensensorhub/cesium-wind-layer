import { WindLayerOptions, WindData } from './types';
import { WindParticlesComputing } from './windParticlesComputing';
import { WindParticlesRendering } from './windParticlesRendering';
import CustomPrimitive from './customPrimitive';
import { ClearCommand, Color, Pass } from 'cesium';
import { deepMerge } from './utils';

export class WindParticleSystem {
  computing: WindParticlesComputing;
  rendering: WindParticlesRendering;
  options: WindLayerOptions;
  viewerParameters: any;
  context: any;
  constructor(context: any, windData: Required<WindData>, options: WindLayerOptions, viewerParameters: any, scene: any) {
    this.context = context;
    this.options = options;
    this.viewerParameters = viewerParameters;
    this.computing = new WindParticlesComputing(context, windData, options, viewerParameters, scene);
    this.rendering = new WindParticlesRendering(context, options, viewerParameters, this.computing);
  }

  getPrimitives(): CustomPrimitive[] {
    const primitives = [
      this.rendering.primitives.heatmap,
      this.rendering.primitives.segments,
    ];

    return primitives;
  }

  clearParticles() {
    this.computing.destroyParticlesTextures();
  }

  changeOptions(options: Partial<WindLayerOptions>) {
    let maxParticlesChanged = false;
    if (options.particlesTextureSize && this.options.particlesTextureSize !== options.particlesTextureSize) {
      maxParticlesChanged = true;
    }

    const newOptions = deepMerge(options, this.options);
    if (newOptions.particlesTextureSize < 1) {
      throw new Error('particlesTextureSize must be greater than 0');
    }
    this.options = newOptions;

    this.rendering.updateOptions(options);
    this.computing.updateOptions(options);
    if (maxParticlesChanged) {
      this.computing.destroyParticlesTextures();
      this.computing.createParticlesTextures();
      this.rendering.onParticlesTextureSizeChange();
    }
  }

  applyViewerParameters(viewerParameters: any): void {
    this.viewerParameters = viewerParameters;
    this.computing.viewerParameters = viewerParameters;
    this.rendering.viewerParameters = viewerParameters;
  }

  destroy(): void {
    this.computing.destroy();
    this.rendering.destroy();
  }
}