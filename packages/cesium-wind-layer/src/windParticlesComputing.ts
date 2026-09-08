import { PixelDatatype, PixelFormat, Sampler, Texture, TextureMagnificationFilter, TextureMinificationFilter, Cartesian2, FrameRateMonitor, Math as CesiumMath, Framebuffer } from 'cesium';
import { WindLayerOptions, WindData } from './types';
import { ShaderManager } from './shaderManager';
import CustomPrimitive from './customPrimitive'
import { deepMerge } from './utils';

export class WindParticlesComputing {
  context: any;
  options: WindLayerOptions;
  viewerParameters: any;
  windTextures!: {
    U: Texture;
    V: Texture;
  };
  particlesTextures!: {
    particlePositions: Texture[]
    particleTimes: Texture[];
  };
  primitives!: {
    updatePosition: CustomPrimitive;
    calculateGenTime: CustomPrimitive;
  };
  windData: Required<WindData>;
  private frameRateMonitor: FrameRateMonitor;
  frameRate: number = 60;
  frameRateAdjustment: number = 1;
  currentPosition: number = 0
  numPositions: number = 8

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
    this.initFrameRate();
    this.createWindTextures();
    this.createParticlesTextures();
    this.createComputingPrimitives();
  }

  private initFrameRate() {
    const updateFrameRate = () => {
      // avoid update frame rate when frame rate is too low
      if (this.frameRateMonitor.lastFramesPerSecond > 20) {
        this.frameRate = this.frameRateMonitor.lastFramesPerSecond;
        this.frameRateAdjustment = 60 / Math.max(this.frameRate, 1);
      }
    }

    // Initial frame rate calculation
    updateFrameRate();

    // Use setInterval instead of requestAnimationFrame
    const intervalId = setInterval(updateFrameRate, 1000);

    // Monitor frame rate changes
    this.frameRateMonitor.lowFrameRate.addEventListener((scene, frameRate) => {
      console.warn(`Low frame rate detected: ${frameRate} FPS`);
    });

    this.frameRateMonitor.nominalFrameRate.addEventListener((scene, frameRate) => {
      console.log(`Frame rate returned to normal: ${frameRate} FPS`);
    });

    // Add cleanup method to destroy
    const originalDestroy = this.destroy.bind(this);
    this.destroy = () => {
      clearInterval(intervalId);
      originalDestroy();
    };
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
    const posTextures = []
    const timeTextures = []
    for(let i=0; i<this.numPositions; i++) {
      posTextures.push(new Texture(options))
      timeTextures.push(new Texture(options))
    }
    this.particlesTextures = {
      particlePositions: posTextures,
      particleTimes: timeTextures,
    };
  }

  destroyParticlesTextures() {
    Object.values(this.particlesTextures).flatMap(texture => texture).forEach(texture => texture.destroy());
  }

  createComputingPrimitives() {
    this.primitives = {

      updatePosition: new CustomPrimitive({
        commandType: 'Compute',
        uniformMap: {
          U: () => this.windTextures.U,
          V: () => this.windTextures.V,
          speedRange: () => new Cartesian2(this.windData.speed.min, this.windData.speed.max),
          speedScaleFactor: () => {
            return (this.viewerParameters.pixelSize + 50) * this.options.speedFactor;
          },
          frameRateAdjustment: () => this.frameRateAdjustment,
          dimension: () => new Cartesian2(this.windData.width, this.windData.height),
          minimum: () => new Cartesian2(this.windData.bounds.west, this.windData.bounds.south),
          maximum: () => new Cartesian2(this.windData.bounds.east, this.windData.bounds.north),
          currentParticlesPosition: () => this.particlesTextures.particlePositions[this.currentPosition],
          particlesGenTime: () => this.particlesTextures.particleTimes[this.currentPosition],
          currentTime: () => performance.now(),
          lonRange: () => new Cartesian2(this.windData.bounds.west, this.windData.bounds.east),
          latRange: () => new Cartesian2(this.windData.bounds.south, this.windData.bounds.north),
          randomCoefficient: function () {
            return Math.random();
          }
        },
        fragmentShaderSource: ShaderManager.getUpdatePositionShader(),
        outputTexture: this.particlesTextures.particlePositions[(this.currentPosition + 1) % this.numPositions],
        isDynamic: () => this.options.dynamic,
        preExecute: () => {
          this.currentPosition = (this.currentPosition + 1) % this.numPositions
          if (this.primitives.updatePosition.commandToExecute) {
            this.primitives.updatePosition.commandToExecute.outputTexture = this.particlesTextures.particlePositions[(this.currentPosition + 1) % this.numPositions];
          }
        }
      }),

      calculateGenTime: new CustomPrimitive({
        commandType: 'Compute',
        uniformMap: {
          currentParticlesPosition: () => this.particlesTextures.particlePositions[this.currentPosition],
          prevParticlesGenTime: () => this.particlesTextures.particleTimes[(this.currentPosition - 1 + this.numPositions) % this.numPositions],
          currentTime: () => performance.now(),
          particleLifeTime: () => this.options.particleLifeTime,
          randomCoefficient: () => Math.random()
        },
        fragmentShaderSource: ShaderManager.getCalculateGenTimeShader(),
        outputTexture: this.particlesTextures.particleTimes[this.currentPosition],
        isDynamic: () => this.options.dynamic,
        preExecute: () => {
          if (this.primitives.calculateGenTime.commandToExecute) {
            this.primitives.calculateGenTime.commandToExecute.outputTexture = this.particlesTextures.particleTimes[(this.currentPosition + 1) % this.numPositions];
          }
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
}
