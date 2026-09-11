import { PixelDatatype, PixelFormat, Sampler, Texture, TextureMagnificationFilter, TextureMinificationFilter, Cartesian2, FrameRateMonitor, Math as CesiumMath, Framebuffer, Texture3D, BoundingRectangle, PrimitiveType, GeometryAttributes, GeometryAttribute, ComponentDatatype, Geometry, PassState } from 'cesium';
import { WindLayerOptions, WindData } from './types';
import { ShaderManager } from './shaderManager';
import CustomPrimitive from './customPrimitive'
import { deepMerge } from './utils';
import FramebufferSlice from './FramebufferSlice';
export class WindParticlesComputing {
  context: any;
  options: WindLayerOptions;
  viewerParameters: any;
  windTextures!: {
    U: Texture;
    V: Texture;
  };
  particlesTextures!: {
    prevParticlePositions: Texture;
    currentParticlePositions: Texture;
    historicalPositions: Texture3D;
  };
  primitives!: {
    updatePosition: CustomPrimitive;
    copyTo3D: CustomPrimitive;
  };
  windData: Required<WindData>;
  private frameRateMonitor: FrameRateMonitor;
  frameRate: number = 60;
  frameRateAdjustment: number = 1;
  currentPosition: number = 0

  constructor(context: any, windData: Required<WindData>, options: WindLayerOptions, viewerParameters: any, scene: any) {
    this.context = context;
    this.options = options;
    this.viewerParameters = viewerParameters;
    this.windData = windData;

    this.frameRateMonitor = new FrameRateMonitor({
      scene: scene,
      samplingWindow: 1.0,
      quietPeriod: 0.0
    });
    this.createWindTextures();
    this.createParticlesTextures();
    this.createComputingPrimitives();
  }

  createWindTextures() {
    const options = {
      context: this.context,
      width: this.windData.width,
      height: this.windData.height,
      pixelFormat: PixelFormat.RED,
      pixelDatatype: PixelDatatype.FLOAT,
      flipY: this.options.flipY ?? false,
      sampler: new Sampler({
        minificationFilter: TextureMinificationFilter.LINEAR,
        magnificationFilter: TextureMagnificationFilter.LINEAR
      })
    }

    this.windTextures = {
      U: new Texture({
        ...options,
        source: {
          arrayBufferView: new Float32Array(this.windData.u.array)
        }
      }),
      V: new Texture({
        ...options,
        source: {
          arrayBufferView: new Float32Array(this.windData.v.array)
        }
      }),
    };
  }

  private getFullscreenQuad() {
    const atts = new GeometryAttributes();
    atts.position = new GeometryAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 3,
      //  v3----v2
      //  |     |
      //  |     |
      //  v0----v1
      values: new Float32Array([
        -1, -1, 0, // v0
        1, -1, 0, // v1
        1, 1, 0, // v2
        -1, 1, 0, // v3
      ])
    });
    atts.st = new GeometryAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 2,
      values: new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1,
      ])
    });
    return new Geometry({
      attributes: atts,
      indices: new Uint32Array([3, 2, 0, 0, 2, 1])
    });
  }

  createParticlesTextures() {
    const options = {
      context: this.context,
      width: this.options.particlesTextureSize,
      height: this.options.particlesTextureSize,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      flipY: false,
      source: {
        arrayBufferView: new Float32Array(this.options.particlesTextureSize * this.options.particlesTextureSize * 4).fill(0)
      },
      sampler: new Sampler({
        minificationFilter: TextureMinificationFilter.NEAREST,
        magnificationFilter: TextureMagnificationFilter.NEAREST
      })
    }

    const options3d = {
      context: this.context,
      width: this.options.particlesTextureSize,
      height: this.options.particlesTextureSize,
      depth: this.options.numberOfSamples,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      flipY: false,
      source: {
        arrayBufferView: new Float32Array(this.options.particlesTextureSize * this.options.particlesTextureSize * 4 * this.options.numberOfSamples).fill(0)
      },
      sampler: new Sampler({
        minificationFilter: TextureMinificationFilter.NEAREST,
        magnificationFilter: TextureMagnificationFilter.NEAREST
      }),
    }

    this.particlesTextures = {
      prevParticlePositions: new Texture(options),
      currentParticlePositions: new Texture(options),
      historicalPositions: new Texture3D(options3d),
    }
  }

  destroyParticlesTextures() {
    Object.values(this.particlesTextures).forEach(texture => texture.destroy());
  }

  createComputingPrimitives() {
    this.primitives = {

      updatePosition: new CustomPrimitive({
        commandType: 'Compute',
        uniformMap: {
          U: () => this.windTextures.U,
          V: () => this.windTextures.V,
          speedRange: () => new Cartesian2(this.windData.speed.min, this.windData.speed.max),
          speedScaleFactor: () => 1000 * this.options.speedFactor,
          dimension: () => new Cartesian2(this.windData.width, this.windData.height),
          minimum: () => new Cartesian2(this.windData.bounds.west, this.windData.bounds.south),
          maximum: () => new Cartesian2(this.windData.bounds.east, this.windData.bounds.north),
          prevParticlesPosition: () => this.particlesTextures.prevParticlePositions,
          lonRange: () => new Cartesian2(this.windData.bounds.west, this.windData.bounds.east),
          latRange: () => new Cartesian2(this.windData.bounds.south, this.windData.bounds.north),
          randomCoefficient: () => Math.random(),
          dropRate: () => this.options.dropRate
        },
        fragmentShaderSource: ShaderManager.getUpdatePositionShader(),
        isDynamic: () => this.options.dynamic,
        outputTexture: this.particlesTextures.currentParticlePositions,
        preExecute: () => {

          //swap textures
          const tmp = this.particlesTextures.prevParticlePositions
          this.particlesTextures.prevParticlePositions = this.particlesTextures.currentParticlePositions
          this.particlesTextures.currentParticlePositions = tmp

          const command = this.primitives.updatePosition.commandToExecute
          if (command) {
            command.outputTexture = this.particlesTextures.currentParticlePositions
          }
        }
      }),

      copyTo3D: new CustomPrimitive({
        commandType: 'Draw',
        uniformMap: {
          currentParticlePositions: () => this.particlesTextures.currentParticlePositions,
        },
        vertexShaderSource: ShaderManager.getViewportQuadVS(),
        attributeLocations: {
          position: 0,
          st: 1
        },
        geometry: this.getFullscreenQuad(),
        primitiveType: PrimitiveType.TRIANGLES,
        fragmentShaderSource: ShaderManager.getCopyPositions(),
        isDynamic: () => this.options.dynamic,
        rawRenderState: {
          viewport: new BoundingRectangle(0, 0, this.options.particlesTextureSize, this.options.particlesTextureSize)
        },
        preExecute: () => {

          const command = this.primitives.copyTo3D.commandToExecute
          if (command) {
            command.framebuffer = new FramebufferSlice({
              context: this.context,
              colorTextures: [this.particlesTextures.historicalPositions],
              destroyAttachments: false,
              viewport: new BoundingRectangle(0, 0, this.options.particlesTextureSize, this.options.particlesTextureSize),
              depth: this.currentPosition
            })
          }
          //increment head of ring buffer
          this.currentPosition = (this.currentPosition + 1) % this.options.numberOfSamples;
        }
      }),
    };
  }

  private reCreateWindTextures() {
    this.windTextures.U.destroy();
    this.windTextures.V.destroy();
    this.createWindTextures();
  }

  updateWindData(data: Required<WindData>) {
    this.windData = data;
    this.reCreateWindTextures();
  }

  updateOptions(options: Partial<WindLayerOptions>) {
    const needUpdateWindTextures = options.flipY !== undefined && options.flipY !== this.options.flipY;
    this.options = deepMerge(options, this.options);
    if (needUpdateWindTextures) {
      this.reCreateWindTextures();
    }
  }

  processWindData(data: {
    array: Float32Array;
    min?: number;
    max?: number;
  }): Float32Array {
    const { array } = data;
    let { min, max } = data;
    const result = new Float32Array(array.length);
    if (min === undefined) {
      console.warn('min is undefined, calculate min');
      min = Math.min(...array);
    }
    if (max === undefined) {
      console.warn('max is undefined, calculate max');
      max = Math.max(...array);
    }

    const maxNum = Math.max(Math.abs(min), Math.abs(max));

    for (let i = 0; i < array.length; i++) {
      const value = array[i] / maxNum; // Normalize to [-1, 1]
      result[i] = value;
    }
    console.log(result)
    return result;
  }

  destroy() {
    Object.values(this.windTextures).forEach(texture => texture.destroy());
    this.destroyParticlesTextures()
    Object.values(this.primitives).forEach(primitive => primitive.destroy());
    this.frameRateMonitor.destroy();
  }

  execute() {
    const ps = new PassState(this.context)
    this.primitives.updatePosition.execute(this.context, ps)
    this.primitives.copyTo3D.execute(this.context, ps)
  }
}
