import { Cartesian3, Rectangle } from 'cesium';

export interface WindLayerOptions {
  /**
   * Size of the particle texture. Determines the maximum number of particles (size squared). Default is 100.
   */
  particlesTextureSize: number;
  /**
   * Width range of particle in meters. This does not include trails Default is { min: 5000, max: 10000 }.
   * Controls the width of the particles.
   * @property {number} min - Minimum width of particle trails
   * @property {number} max - Maximum width of particle trails
   */
  particleWidth: {
    min: number;
    max: number;
  };
  /**
   * Factor to adjust the speed of particles. Default is 1.0.
   * Controls the movement speed of particles.
   */
  speedFactor: number;

  /**
   * Whether to flip the Y-axis of the wind data. Default is false.
   */
  flipY: boolean;
  /**
   * Array of colors for particles. Can be used to create color gradients.
   * Default is ['white'].
   */
  colors: string[];
  /**
   * Controls the speed rendering range. Default is undefined.
   * @property {number} [min] - Minimum speed value for rendering
   * @property {number} [max] - Maximum speed value for rendering
   */
  domain?: {
    min?: number;
    max?: number;
  };
  /**
   * Controls the speed display range for visualization. Default is undefined.
   * @property {number} [min] - Minimum speed value for display
   * @property {number} [max] - Maximum speed value for display
   */
  displayRange?: {
    min?: number;
    max?: number;
  };
  /**
   * Whether to enable dynamic particle animation. Default is true.
   * When set to false, particles will remain static.
   */
  dynamic: boolean;

  /**
   * 0-1 alpha value for heatmap
   */
  heatmapOpacity: number;

  /**
   * 0-1 alpha value for particles
   */
  particlesOpacity: number;

  /**
   * Lat lon bounds for displaying data.
   */
  displayBounds: Rectangle;

  /**
   * Controls the number of historical positions, which affects the length of the trails
   */
  numberOfSamples: number;

  /**
   * Rate at which particles are dropped (reset). Default is 0.003.
   * Controls the lifecycle of particles.
   */
  dropRate: number;
}

export interface WindDataDemention {
  array: Float32Array;
  min?: number;
  max?: number;
}

export interface WindData {
  u: WindDataDemention;
  v: WindDataDemention;
  speed?: WindDataDemention;
  width: number;
  height: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

export interface Particle {
  position: Cartesian3;
  age: number;
}

export interface WindDataAtLonLat {
  /**
   * Original data at the grid point
   */
  original: {
    /**
     * Original U component
     */
    u: number;
    /**
     * Original V component
     */
    v: number;
    /**
     * Original speed
     */
    speed: number;
  };
  /**
   * Interpolated data between grid points
   */
  interpolated: {
    /**
     * Interpolated U component
     */
    u: number;
    /**
     * Interpolated V component
     */
    v: number;
    /**
     * Interpolated speed
     */
    speed: number;
  };
}
