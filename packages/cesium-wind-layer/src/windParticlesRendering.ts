import { Math as CesiumMath, Geometry, GeometryAttribute, ComponentDatatype, PrimitiveType, GeometryAttributes, Color, Texture, Sampler, TextureMinificationFilter, TextureMagnificationFilter, PixelFormat, PixelDatatype, Framebuffer, Appearance, SceneMode, TextureWrap, VertexArray, BufferUsage, Cartesian2, Primitive, RectangleGeometry, VertexFormat, DepthFunction } from 'cesium';
import { WindLayerOptions } from './types';
import { WindParticlesComputing } from './windParticlesComputing';
import CustomPrimitive from './customPrimitive';
import { ShaderManager } from './shaderManager';
import { deepMerge } from './utils';
import { DefaultOptions } from '.';


export class WindParticlesRendering {
  private context: any;
  private options: WindLayerOptions;
  viewerParameters: any;
  private computing: WindParticlesComputing;
  public primitives!: ReturnType<typeof this.createPrimitives>;
  public colorTable: Texture;
  textures: ReturnType<typeof this.createRenderingTextures>;

  constructor(context: any, options: WindLayerOptions, viewerParameters: any, computing: WindParticlesComputing) {
    this.context = context;
    this.options = options;
    this.viewerParameters = viewerParameters;
    this.computing = computing;

    if (typeof this.options.particlesTextureSize !== 'number' || this.options.particlesTextureSize <= 0) {
      console.error('Invalid particlesTextureSize. Using default value of 256.');
      this.options.particlesTextureSize = 256;
    }

    this.colorTable = this.createColorTableTexture();
    this.textures = this.createRenderingTextures();
    this.primitives = this.createPrimitives();
  }

  createRenderingTextures() {
    const depthTextureOptions = {
      context: this.context,
      width: this.context.drawingBufferWidth,
      height: this.context.drawingBufferHeight,
      pixelFormat: PixelFormat.DEPTH_COMPONENT,
      pixelDatatype: PixelDatatype.UNSIGNED_INT
    };

    return {
      segmentsDepth: new Texture(depthTextureOptions),
    }
  }

  private createColorTableTexture(): Texture {
    const colorTableData = new Float32Array(this.options.colors.flatMap(color => {
      const cesiumColor = Color.fromCssColorString(color);
      return [cesiumColor.red, cesiumColor.green, cesiumColor.blue, cesiumColor.alpha];
    }));

    return new Texture({
      context: this.context,
      width: this.options.colors.length,
      height: 1,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      sampler: new Sampler({
        minificationFilter: TextureMinificationFilter.LINEAR,
        magnificationFilter: TextureMagnificationFilter.LINEAR,
        wrapS: TextureWrap.CLAMP_TO_EDGE,
        wrapT: TextureWrap.CLAMP_TO_EDGE
      }),
      source: {
        width: this.options.colors.length,
        height: 1,
        arrayBufferView: colorTableData
      }
    });
  }

createSegmentsGeometry(): Geometry {
  const texureSize = this.options.particlesTextureSize;

  let st: number[] = [];
  let normal: number[] = [];
  let vertexIndexes: number[] = [];
  let vertexCount = 0;
  let particleCount = 0;

  for (let s = 0; s < texureSize; s++) {
    for (let t = 0; t < texureSize; t++) {
      const u = s / texureSize;
      const v = t / texureSize;
      for (let j = 0; j < this.computing.numPositions; j++) {
        st.push(u, v);
        st.push(u, v); 
        st.push(u, v); 
        st.push(u, v);

        // (normal offset, ring buffer index, particle id)
        normal.push(-1, j, particleCount);
        normal.push(1, j, particleCount);
        normal.push(-1, j + 1, particleCount);
        normal.push(1, j + 1, particleCount);

        vertexIndexes.push(
          vertexCount + 0, vertexCount + 1, vertexCount + 2,
          vertexCount + 1, vertexCount + 3, vertexCount + 2
        );

        vertexCount += 4;
      }
    }
    particleCount++;
  }

  return new Geometry({
    attributes: new (GeometryAttributes as any)({
      st: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: new Float32Array(st)
      }),
      normal: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: new Float32Array(normal)
      }),
    }),
    indices: new Uint32Array(vertexIndexes)
  });
}

  createHeatmapGeometry(): Geometry {
    return RectangleGeometry.createGeometry(new RectangleGeometry({
      rectangle: this.viewerParameters.dataBounds,
      height: 0.0,
      vertexFormat: VertexFormat.POSITION_AND_ST
    }))!;
  }

  private createRawRenderState(options: {
    viewport?: any;
    depthTest?: any;
    depthMask?: any;
    blending?: any;
  }): any {
    return (Appearance as any).getDefaultRenderState(true, false, {
      viewport: undefined,
      depthTest: undefined,
      depthMask: undefined,
      blending: undefined,
      ...options
    });
  }

  private createPrimitives() {
    const segments = new CustomPrimitive({
      commandType: 'Draw',
      attributeLocations: {
        st: 0,
        normal: 1
      },
      geometry: this.createSegmentsGeometry(),
      primitiveType: PrimitiveType.TRIANGLES,
      uniformMap: {
        particlesPosition: () => this.computing.particlesTextures.historicalPositions,
        currentLayer: () => this.computing.currentPosition - 1,
        numLayers: () => this.computing.numPositions,
        currentTime: () => performance.now(),
        numParticles: () => this.options.particlesTextureSize ** 2,
        particleFadeInTime: () => this.options.particleFadeInTime,
        particleFadeOutTime: () => this.options.particleFadeOutTime,
        lonRange: () => new Cartesian2(this.computing.windData.bounds.west, this.computing.windData.bounds.east),
        latRange: () => new Cartesian2(this.computing.windData.bounds.south, this.computing.windData.bounds.north),
        colorTable: () => this.colorTable,
        domain: () => new Cartesian2(this.options.domain?.min ?? this.computing.windData.speed.min, this.options.domain?.max ?? this.computing.windData.speed.max),
        displayRange: () => {
          const displayRange = new Cartesian2(
            this.options.displayRange?.min ?? this.computing.windData.speed.min,
            this.options.displayRange?.max ?? this.computing.windData.speed.max
          );
          return displayRange;
        },
        lineWidth: () => {
          const width = this.options.particleWidth || DefaultOptions.particleWidth;
          return new Cartesian2(width.min, width.max);
        },
        is3D: () => this.viewerParameters.sceneMode === SceneMode.SCENE3D,
        latDisplayRange: () =>  new Cartesian2(CesiumMath.toDegrees(this.options.displayBounds.south), CesiumMath.toDegrees(this.options.displayBounds.north)),
        lonDisplayRange: () => new Cartesian2(CesiumMath.toDegrees(this.options.displayBounds.west), CesiumMath.toDegrees(this.options.displayBounds.east)),
        segmentsDepthTexture: () => this.textures.segmentsDepth,
      },
      vertexShaderSource: ShaderManager.getSegmentDrawVertexShader(),
      fragmentShaderSource: ShaderManager.getSegmentDrawFragmentShader(),
      rawRenderState: this.createRawRenderState({
        // viewport: {
        //   height: this.texSize,
        //   width: this.texSize
        // },
        depthTest: {
          enabled: true
        },
        depthMask: false,
        blending: {
          enabled: true,
          blendEquation: WebGLRenderingContext.FUNC_ADD,
          blendFuncSource: WebGLRenderingContext.SRC_ALPHA,
          blendFuncDestination: WebGLRenderingContext.ONE_MINUS_SRC_ALPHA
        }
      }),
      //framebuffer: this.framebuffers.segments,
      //autoClear: true
    });

    // const trails = new CustomPrimitive({
    //   commandType: 'Draw',
    //   attributeLocations: {
    //     position: 0,
    //     st: 1
    //   },
    //   geometry: this.getFullscreenQuad(),
    //   primitiveType: PrimitiveType.TRIANGLES,
    //   uniformMap: {
    //     trailsColor: () => this.framebuffers.currentTrails.getColorTexture(0),
    //     segmentsColor: () => this.framebuffers.segments.getColorTexture(0),
    //     trailFade: () => this.options.trailFade
    //   },
    //   vertexShaderSource: ShaderManager.getTrailsDrawVertexShader(),
    //   fragmentShaderSource: ShaderManager.getTrailsDrawFragmentShader(),
    //   rawRenderState: this.createRawRenderState({
    //     viewport: {
    //       height: this.texSize,
    //       width: this.texSize
    //     },
    //     depthTest: {
    //       enabled: false,
    //       func: DepthFunction.ALWAYS
    //     },
    //     depthMask: false,
    //     blending: {
    //       enabled: false,
    //     }
    //   }),
    //   preExecute: () => {
    //     //swap framebuffers
    //     const tmp = this.framebuffers.currentTrails;
    //     this.framebuffers.currentTrails = this.framebuffers.nextTrails
    //     this.framebuffers.nextTrails = tmp
    //     if(this.primitives.trails.commandToExecute) {
    //       this.primitives.trails.commandToExecute.framebuffer = this.framebuffers.nextTrails;
    //     }
        
    //   },
    //   framebuffer: this.framebuffers.nextTrails,
    // });

    // const screen = new CustomPrimitive({
    //   commandType: 'Draw',
    //   attributeLocations: {
    //     position: 0,
    //     st: 1
    //   },
    //   geometry: this.createHeatmapGeometry(),
    //   primitiveType: PrimitiveType.TRIANGLES,
    //   uniformMap: {
    //     tex: () => this.framebuffers.nextTrails.getColorTexture(0),
    //     opacity: () => this.options.particlesOpacity
    //   },
    //   vertexShaderSource: ShaderManager.getScreenDrawVertexShader(),
    //   fragmentShaderSource: ShaderManager.getScreenDrawFragmentShader(),
    //   rawRenderState: this.createRawRenderState({
    //     viewport: undefined,
    //     depthTest: {
    //       enabled: true
    //     },
    //     depthMask: false,
    //     blending: {
    //       enabled: true,
    //       blendEquation: WebGLRenderingContext.FUNC_ADD,
    //       blendFuncSource: WebGLRenderingContext.SRC_ALPHA,
    //       blendFuncDestination: WebGLRenderingContext.ONE_MINUS_SRC_ALPHA
    //     }
    //   }),
    // });

    const heatmap = new CustomPrimitive({
      name: 'heatmap',
      commandType: 'Draw',
      attributeLocations: {
        st: 0,
        position: 1
      },
      geometry: this.createHeatmapGeometry(),
      primitiveType: PrimitiveType.TRIANGLES,
      uniformMap: {
        U: () => this.computing.windTextures.U,
        V: () =>  this.computing.windTextures.V,
        domain: () => new Cartesian2(this.options.domain?.min ?? this.computing.windData.speed.min, this.options.domain?.max ?? this.computing.windData.speed.max),
        colorTable: () =>  this.colorTable,
        opacity: () => this.options.heatmapOpacity
      },
      vertexShaderSource: ShaderManager.getHeatmapVertexShader(),
      fragmentShaderSource: ShaderManager.getHeatmapFragmentShader(),
      rawRenderState: this.createRawRenderState({
        viewport: undefined,
        depthTest: {
          enabled: true
        },
        depthMask: false,
        blending: {
          enabled: true,
          blendEquation: WebGLRenderingContext.FUNC_ADD,
          blendFuncSource: WebGLRenderingContext.SRC_ALPHA,
          blendFuncDestination: WebGLRenderingContext.ONE_MINUS_SRC_ALPHA
        },
      })
    })

    return { segments, heatmap }//, screen, trails };
  }

  onParticlesTextureSizeChange() {
    const geometry = this.createSegmentsGeometry();
    this.primitives.segments.geometry = geometry;
    const vertexArray = VertexArray.fromGeometry({
      context: this.context,
      geometry: geometry,
      attributeLocations: this.primitives.segments.attributeLocations,
      bufferUsage: BufferUsage.STATIC_DRAW,
    });
    if (this.primitives.segments.commandToExecute) {
      this.primitives.segments.commandToExecute.vertexArray = vertexArray;
    }
  }

  onColorTableChange() {
    this.colorTable.destroy();
    this.colorTable = this.createColorTableTexture();
  }

  updateOptions(options: Partial<WindLayerOptions>) {
    const needUpdateColorTable = options.colors &&
      JSON.stringify(options.colors) !== JSON.stringify(this.options.colors);

    // Update options first
    this.options = deepMerge(options, this.options);

    // Then update color table if needed
    if (needUpdateColorTable) {
      this.onColorTableChange();
    }
  }

  destroy(): void {
    Object.values(this.primitives).forEach((primitive: any) => {
      primitive.destroy();
    });
    this.colorTable.destroy();
  }
}
