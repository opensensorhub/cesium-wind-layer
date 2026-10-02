import { PixelDatatype, PixelFormat, Sampler, Texture, TextureMagnificationFilter, TextureMinificationFilter, Cartesian2, FrameRateMonitor, Math as CesiumMath, Framebuffer, Texture3D, BoundingRectangle, PrimitiveType, GeometryAttributes, GeometryAttribute, ComponentDatatype, Geometry, PassState, ComputeEngine, RenderState } from 'cesium';
import { WindLayerOptions, WindData } from './types';
import { ShaderManager } from './shaderManager';
import CustomPrimitive from './customPrimitive'
import { deepMerge } from './utils';
import FramebufferSlice from './FramebufferSlice';
export class WindParticlesComputing {
  context: any;
  options: WindLayerOptions;
  windTextures!: {
    UV: Texture;
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
  framebufferSlices: FramebufferSlice[]
  computeEngine: ComputeEngine
  deltaTime: number

  constructor(context: any, windData: Required<WindData>, options: WindLayerOptions, scene: any) {
    this.context = context;
    this.options = options;
    this.windData = windData;
    this.computeEngine = new ComputeEngine(context);
    this.deltaTime = 0;

    this.frameRateMonitor = new FrameRateMonitor({
      scene: scene,
      samplingWindow: 1.0,
      quietPeriod: 0.0
    });
    this.framebufferSlices = []
    this.createWindTextures();
    this.createParticlesTextures();
    this.createComputingPrimitives();
    this.createFramebufferSlices();

  }

  createWindTextures() {
    const options = {
      context: this.context,
      width: this.windData.width,
      height: this.windData.height,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      flipY: this.options.flipY ?? false,
      sampler: new Sampler({
        minificationFilter: TextureMinificationFilter.LINEAR,
        magnificationFilter: TextureMagnificationFilter.LINEAR
      })
    }

    const packedUV = new Float32Array(options.width * options.height * 4);

    for (let i = 0, j = 0; i < options.width * options.height; i++, j += 4) {
      packedUV[j] = this.windData.u_ll.array[i];
      packedUV[j + 1] = this.windData.v_ll.array[i];
      packedUV[j + 2] = this.windData.u.array[i];
      packedUV[j + 3] = this.windData.v.array[i];
    }

    this.windTextures = {
      UV: new Texture({
        ...options,
        source: {
          arrayBufferView: packedUV
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
  
  private createFramebufferSlices() {
    for(let i=0; i<this.options.numberOfSamples; i++) {
      this.framebufferSlices.push(new FramebufferSlice({
        context: this.context,
        colorTextures: [this.particlesTextures.historicalPositions],
        destroyAttachments: false,
        viewport: new BoundingRectangle(0, 0, this.options.particlesTextureSize, this.options.particlesTextureSize),
        depth: i
      }))
    }
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

  destroyFramebufferSlices() {
    this.framebufferSlices.forEach(slice => slice.destroy())
    this.framebufferSlices = []
  }

  onParticlesTextureSizeChange() {
    this.destroyParticlesTextures()
    this.destroyFramebufferSlices()
    this.createParticlesTextures()
    this.createFramebufferSlices()

    const copyTo3D = this.primitives.copyTo3D
    copyTo3D.rawRenderState.viewport = new BoundingRectangle(0, 0, this.options.particlesTextureSize, this.options.particlesTextureSize)
    if (copyTo3D.commandToExecute) {
      (copyTo3D.commandToExecute as any).renderState = RenderState.fromCache(copyTo3D.rawRenderState)
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
          UV: () => this.windTextures.UV,
          speedMin: () => this.windData.speed.min,
          speedMax: () => this.windData.speed.max,
          speedScaleFactor: () => 1000 * this.options.speedFactor,
          width: () => this.windData.width,
          height: () => this.windData.height,
          minLat: () => this.windData.bounds.south,
          maxLat: () => this.windData.bounds.north,
          minLon: () => this.windData.bounds.west,
          maxLon: () => this.windData.bounds.east,
          prevParticlesPosition: () => this.particlesTextures.prevParticlePositions,
          minDisplayLon: () => this.options.displayBounds ? this.options.displayBounds.west : this.windData.bounds.west,
          minDisplayLat: () => this.options.displayBounds ? this.options.displayBounds.south : this.windData.bounds.south,
          maxDisplayLon: () => this.options.displayBounds ? this.options.displayBounds.east : this.windData.bounds.east,
          maxDisplayLat: () => this.options.displayBounds ? this.options.displayBounds.north : this.windData.bounds.north,
          randomCoefficient: () => Math.random(),
          deltaTime: () => this.deltaTime,
          maxParticleTTL: () => this.options.maxParticleTTL,
          minParticleTTL: () => this.options.minParticleTTL
        },
        fragmentShaderSource: ShaderManager.getUpdatePositionShader(),
        isDynamic: () => this.options.dynamic,
        outputTexture: this.particlesTextures.currentParticlePositions,
        preExecute: () => {
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
          particleHeight: () => this.options.particleHeight || 0,
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
            command.framebuffer = this.framebufferSlices[this.currentPosition]
          }
        }
      }),
    };
  }

  private reCreateWindTextures() {
    this.windTextures.UV.destroy();
    this.createWindTextures();
  }

  updateWindData(data: Required<WindData>) {
    this.windData = data;
    this.reCreateWindTextures();
  }

  updateOptions(options: Partial<WindLayerOptions>) {
    const needUpdateWindTextures = options.flipY !== undefined && options.flipY !== this.options.flipY;
    const updatedSamples = options.numberOfSamples && this.options.numberOfSamples !== options.numberOfSamples;
    this.options = deepMerge(options, this.options);
    if (needUpdateWindTextures) {
      this.reCreateWindTextures();
    }
    
    if(updatedSamples) {
      this.destroyParticlesTextures()
      this.destroyFramebufferSlices()
      this.createParticlesTextures()
      this.createFramebufferSlices()
    }
  }

  swapTextures() {
    const tmp = this.particlesTextures.prevParticlePositions
    this.particlesTextures.prevParticlePositions = this.particlesTextures.currentParticlePositions
    this.particlesTextures.currentParticlePositions = tmp
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

  execute(deltaTime: number) {
    this.primitives.updatePosition.execute(this.context, this.computeEngine)
    this.primitives.copyTo3D.execute(this.context, this.computeEngine)
    if(this.options.dynamic) {
      this.deltaTime = deltaTime
      this.swapTextures();
      //increment head of ring buffer
      this.currentPosition = (this.currentPosition + 1) % this.options.numberOfSamples;
    }
  }
}
