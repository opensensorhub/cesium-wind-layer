import { Math as CesiumMath, Geometry, GeometryAttribute, ComponentDatatype, PrimitiveType, GeometryAttributes, Color, Texture, Sampler, TextureMinificationFilter, TextureMagnificationFilter, PixelFormat, PixelDatatype, Framebuffer, Appearance, SceneMode, TextureWrap, VertexArray, BufferUsage, Cartesian2, Primitive, RectangleGeometry, VertexFormat, DepthFunction, IndexDatatype } from 'cesium';
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
        st.push(
          u, v,
          u, v
        );

        // (normal offset, ring buffer index, particle id)
        normal.push(
          -1, j, particleCount,
          1, j, particleCount
        );

        vertexIndexes.push(
          vertexCount + 0, vertexCount + 1
        );

        vertexCount += 2;
      }
      //degenerate vertex
      //this avoids connecting 2 different segments together
      vertexIndexes.push(0xFFFFFFFF);
      particleCount++;
    }
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
    indices: new Uint32Array(vertexIndexes),
    primitiveType: PrimitiveType.TRIANGLE_STRIP,
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
      primitiveType: PrimitiveType.TRIANGLE_STRIP,
      uniformMap: {
        particlesPosition: () => this.computing.particlesTextures.historicalPositions,
        currentLayer: () => this.computing.currentPosition - 1,
        numLayers: () => this.computing.numPositions,
        colorTable: () => this.colorTable,
        lineWidth: () => {
          const width = this.options.particleWidth || DefaultOptions.particleWidth;
          return new Cartesian2(width.min, width.max);
        },
        segmentsDepthTexture: () => this.textures.segmentsDepth,
      },
      vertexShaderSource: ShaderManager.getSegmentDrawVertexShader(),
      fragmentShaderSource: ShaderManager.getSegmentDrawFragmentShader(),
      rawRenderState: this.createRawRenderState({
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
    });


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
