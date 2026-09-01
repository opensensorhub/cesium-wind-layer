import {
  Viewer,
  Scene,
  Cartesian2,
  SceneMode,
  Rectangle,
  Entity,
} from 'cesium';

import { WindLayerOptions, WindData, WindDataAtLonLat } from './types';
import { WindParticleSystem } from './windParticleSystem';
import { deepMerge } from './utils';
import CustomPrimitive from './customPrimitive';

export * from './types';

type WindLayerEventType = 'dataChange' | 'optionsChange';
type WindLayerEventCallback = (data: WindData | WindLayerOptions) => void;

export const DefaultOptions: WindLayerOptions = {
  particlesTextureSize: 100,
  particleHeight: 1000,
  speedFactor: 1.0,
  particleWidth: { min: 5000, max: 10000 },
  colors: ['white'],
  flipY: false,
  domain: undefined,
  displayRange: undefined,
  dynamic: true,
  particleFadeInTime: 500,
  particleFadeOutTime: 500,
  particleLifeTime: 2000,
  heatmapOpacity: 1,
  particlesOpacity: 1,
  trailFade: 0.97
}

const NUMBER_OF_SAMPLES_PER_AXIS = 128 

export class WindLayer {
  private _showParticles: boolean = true;
  private _showHeatmap: boolean = true;
  private _resized: boolean = false;
  private entity: undefined|Entity = undefined;
  windData: Required<WindData>;
  
  get show(): boolean {
    return this._showParticles;
  }

  set show(value: boolean) {
    let update = false
    if (this._showParticles !== value) {
      this._showParticles = value;
      update = true;
    }
    
    if (this._showHeatmap !== value) {
      this._showHeatmap = value;
      update = true;
    }

    if(update) {
      this.updatePrimitivesVisibility(value);
    }
  }

  get showParticles(): boolean {
    return this._showParticles;
  }

  set showParticles(value: boolean) {
    if (this._showParticles !== value) {
      this._showParticles = value;
      this.updateParticlesVisibility(value);
    }
  }

  get showHeatmap(): boolean {
    return this._showHeatmap;
  }

  set showHeatmap(value: boolean) {
    if (this._showHeatmap !== value) {
      this._showHeatmap = value;
      this.updateHeatmapVisibility(value);
    }
  }

  static defaultOptions: WindLayerOptions = DefaultOptions;

  viewer: Viewer;
  scene: Scene;
  options: WindLayerOptions;
  private particleSystem: WindParticleSystem;
  private viewerParameters: {
    dataBounds: Rectangle;
    pixelSize: number;
    sceneMode: SceneMode;
  };
  private screenSamples: Cartesian2[]
  private _isDestroyed: boolean = false;
  private primitives: CustomPrimitive[] = [];
  private eventListeners: Map<WindLayerEventType, Set<WindLayerEventCallback>> = new Map();

  /**
   * WindLayer class for visualizing wind field data with particle animation in Cesium.
   * 
   * @class
   * @param {Viewer} viewer - The Cesium viewer instance.
   * @param {WindData} windData - The wind field data to visualize.
   * @param {Partial<WindLayerOptions>} [options] - Optional configuration options for the wind layer.
   * @param {number} [options.particlesTextureSize=100] - Size of the particle texture. Determines the maximum number of particles (size squared).
   * @param {number} [options.particleHeight=0] - Height of particles above the ground in meters.
   * @param {Object} [options.particleWidth={ min: 5000, max: 1000 }] - Width range of particles.
   * @param {number} [options.speedFactor=1.0] - Factor to adjust the speed of particles.
   * @param {string[]} [options.colors=['white']] - Array of colors for particles. Can be used to create color gradients.
   * @param {boolean} [options.flipY=false] - Whether to flip the Y-axis of the wind data.
   * @param {boolean} [options.dynamic=true] - Whether to enable dynamic particle animation.
   */
  constructor(viewer: Viewer, windData: WindData, options?: Partial<WindLayerOptions>) {
    this.showHeatmap = true;
    this.showParticles = true;
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.options = { ...WindLayer.defaultOptions, ...options };
    this.windData = this.processWindData(windData);
    this.screenSamples = []
    this.updateScreenSamples();
    this.viewerParameters = {
      dataBounds: Rectangle.fromDegrees(this.windData.bounds.west, this.windData.bounds.south, this.windData.bounds.east, this.windData.bounds.north),
      pixelSize: 1000.0,
      sceneMode: this.scene.mode
    };
    this.updateViewerParameters();

    this.particleSystem = new WindParticleSystem(this.scene.context, this.windData, this.options, this.viewerParameters, this.scene);
    
    this.add();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.viewer.camera.percentageChanged = 0.01;
    this.scene.morphComplete.addEventListener(this.updateViewerParameters.bind(this));
    window.addEventListener("resize", () => {
      this.updateScreenSamples.bind(this);
      this.updateViewerParameters.bind(this)
    });
  }

  private removeEventListeners(): void {
    this.scene.morphComplete.removeEventListener(this.updateViewerParameters.bind(this));
    window.removeEventListener("resize", this.updateViewerParameters.bind(this));
  }

  private updateScreenSamples() {

    const canvas = this.viewer.canvas
    
    this.screenSamples = [];

    for (let y = 0; y <= NUMBER_OF_SAMPLES_PER_AXIS; y++) {
      for (let x = 0; x <= NUMBER_OF_SAMPLES_PER_AXIS; x++) {
        this.screenSamples.push(
          new Cartesian2(
            (x / NUMBER_OF_SAMPLES_PER_AXIS) * canvas.clientWidth,
            (y / NUMBER_OF_SAMPLES_PER_AXIS) * canvas.clientHeight
          )
        );
      }
    }
  }

  private processWindData(windData: WindData): Required<WindData> {
    if (windData.speed?.min === undefined || windData.speed?.max === undefined || windData.speed.array === undefined) {
      const speed = {
        array: new Float32Array(windData.u.array.length),
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE
      };
      for (let i = 0; i < windData.u.array.length; i++) {
        speed.array[i] = Math.sqrt(windData.u.array[i] * windData.u.array[i] + windData.v.array[i] * windData.v.array[i]);
        if (speed.array[i] !== 0) {
          speed.min = Math.min(speed.min, speed.array[i]);
          speed.max = Math.max(speed.max, speed.array[i]);
        }
      }
      windData = { ...windData, speed };
    }

    return windData as Required<WindData>;
  }

  /**
   * Get the wind data at a specific longitude and latitude.
   * @param {number} lon - The longitude.
   * @param {number} lat - The latitude.
   * @returns {Object} - An object containing the u, v, and speed values at the specified coordinates.
   */
  getDataAtLonLat(lon: number, lat: number): WindDataAtLonLat | null {
    const { bounds, width, height, u, v, speed } = this.windData;
    const { flipY } = this.options;

    // Check if the coordinates are within bounds
    if (lon < bounds.west || lon > bounds.east || lat < bounds.south || lat > bounds.north) {
      return null;
    }

    // Calculate normalized coordinates
    const xNorm = (lon - bounds.west) / (bounds.east - bounds.west) * (width - 1);
    let yNorm = (lat - bounds.south) / (bounds.north - bounds.south) * (height - 1);

    // Apply flipY if enabled
    if (flipY) {
      yNorm = height - 1 - yNorm;
    }

    // Get exact grid point for original values
    const x = Math.floor(xNorm);
    const y = Math.floor(yNorm);

    // Get the four surrounding grid points for interpolation
    const x0 = Math.floor(xNorm);
    const x1 = Math.min(x0 + 1, width - 1);
    const y0 = Math.floor(yNorm);
    const y1 = Math.min(y0 + 1, height - 1);

    // Calculate interpolation weights
    const wx = xNorm - x0;
    const wy = yNorm - y0;

    // Get indices
    const index = y * width + x;
    const i00 = y0 * width + x0;
    const i10 = y0 * width + x1;
    const i01 = y1 * width + x0;
    const i11 = y1 * width + x1;

    // Bilinear interpolation for u component
    const u00 = u.array[i00];
    const u10 = u.array[i10];
    const u01 = u.array[i01];
    const u11 = u.array[i11];
    const uInterp = (1 - wx) * (1 - wy) * u00 + wx * (1 - wy) * u10 +
      (1 - wx) * wy * u01 + wx * wy * u11;

    // Bilinear interpolation for v component
    const v00 = v.array[i00];
    const v10 = v.array[i10];
    const v01 = v.array[i01];
    const v11 = v.array[i11];
    const vInterp = (1 - wx) * (1 - wy) * v00 + wx * (1 - wy) * v10 +
      (1 - wx) * wy * v01 + wx * wy * v11;

    // Calculate interpolated speed
    const interpolatedSpeed = Math.sqrt(uInterp * uInterp + vInterp * vInterp);

    return {
      original: {
        u: u.array[index],
        v: v.array[index],
        speed: speed.array[index],
      },
      interpolated: {
        u: uInterp,
        v: vInterp,
        speed: interpolatedSpeed,
      }
    };
  }

  private updateViewerParameters(): void {
    this.viewerParameters.sceneMode = this.scene.mode;
    this.particleSystem?.applyViewerParameters(this.viewerParameters);
  }

  /**
   * Update the wind data of the wind layer.
   * @param {WindData} data - The new wind data to apply.
   */
  updateWindData(data: WindData): void {
    if (this._isDestroyed) return;
    this.windData = this.processWindData(data);
    this.particleSystem.computing.updateWindData(this.windData);
    this.viewer.scene.requestRender();
    // Dispatch data change event
    this.dispatchEvent('dataChange', this.windData);
  }

  /**
   * Update the options of the wind layer.
   * @param {Partial<WindLayerOptions>} options - The new options to apply.
   */
  updateOptions(options: Partial<WindLayerOptions>): void {
    if (this._isDestroyed) return;
    this.options = deepMerge(options, this.options);
    this.particleSystem.changeOptions(options);
    this.viewer.scene.requestRender();
    // Dispatch options change event
    this.dispatchEvent('optionsChange', this.options);
  }

  /**
   * Zoom to the wind data bounds.
   * @param {number} [duration=0] - The duration of the zoom animation.
   */
  zoomTo(duration: number = 0): void {
    if (this.windData.bounds) {
      const rectangle = Rectangle.fromDegrees(
        this.windData.bounds.west,
        this.windData.bounds.south,
        this.windData.bounds.east,
        this.windData.bounds.north
      );
      this.viewer.camera.flyTo({
        destination: rectangle,
        duration,
      });
    }
  }

  /**
   * Add the wind layer to the scene.
   */
  add(): void {
    this.primitives = this.particleSystem.getPrimitives();
    this.primitives.forEach(primitive => {
      this.scene.primitives.add(primitive);
    });
  }

  /**
   * Remove the wind layer from the scene.
   */
  remove(): void {
    this.primitives.forEach(primitive => {
      this.scene.primitives.remove(primitive);
    });
    this.primitives = [];
  }

  /**
   * Check if the wind layer is destroyed.
   * @returns {boolean} - True if the wind layer is destroyed, otherwise false.
   */
  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Destroy the wind layer and release all resources.
   */
  destroy(): void {
    this.remove();
    this.removeEventListeners();
    this.particleSystem.destroy();
    // Clear all event listeners
    this.eventListeners.clear();
    this._isDestroyed = true;
  }

  private updatePrimitivesVisibility(visibility?: boolean): void {
    const show = visibility !== undefined ? visibility : this._showHeatmap && this._showParticles;
    this.primitives.forEach(primitive => {
      primitive.show = show;
    });
  }

  private updateParticlesVisibility(visibility?: boolean): void {
    const showParticles = visibility !== undefined ? visibility : this._showParticles;
    this.primitives.forEach(primitive => {
      if(primitive.name !== 'heatmap') {
        primitive.show = showParticles;
      }
    });
  }

  private updateHeatmapVisibility(visibility?: boolean): void {
    const showHeatmap = visibility !== undefined ? visibility : this._showHeatmap;
    this.primitives.forEach(primitive => {
      if(primitive.name === 'heatmap') {
        primitive.show = showHeatmap;
      }
    });
  }

  /**
   * Add an event listener for the specified event type.
   * @param {WindLayerEventType} type - The type of event to listen for.
   * @param {WindLayerEventCallback} callback - The callback function to execute when the event occurs.
   */
  addEventListener(type: WindLayerEventType, callback: WindLayerEventCallback) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)?.add(callback);
  }

  /**
   * Remove an event listener for the specified event type.
   * @param {WindLayerEventType} type - The type of event to remove.
   * @param {WindLayerEventCallback} callback - The callback function to remove.
   */
  removeEventListener(type: WindLayerEventType, callback: WindLayerEventCallback) {
    this.eventListeners.get(type)?.delete(callback);
  }

  private dispatchEvent(type: WindLayerEventType, data: WindData | WindLayerOptions) {
    this.eventListeners.get(type)?.forEach(callback => callback(data));
  }

}

export type { WindLayerOptions, WindData, WindLayerEventType, WindLayerEventCallback };
