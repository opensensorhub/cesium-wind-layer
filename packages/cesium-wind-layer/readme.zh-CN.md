# Cesium Wind Layer

[![npm version](https://img.shields.io/npm/v/cesium-wind-layer.svg)](https://www.npmjs.com/package/cesium-wind-layer)
[![license](https://img.shields.io/npm/l/cesium-wind-layer.svg)](https://github.com/your-repo/cesium-wind-layer/blob/main/LICENSE)

一个GPU加速的用于通过粒子动画可视化风场数据的 Cesium 插件。

[English](/packages/cesium-wind-layer/readme.md) | [在线演示](https://cesium-wind-layer.opendde.com/)

| Wind Layer | Terrain Occlusion |
|-----------------|------------------------|
| ![Wind Layer Demo](/pictures/wind.gif) | ![Terrain Occlusion Demo](/pictures/terrain.gif) |

## 📚 目录

- [特性](#特性)
- [安装](#安装)
- [使用方法](#使用方法)
- [API 参考](#api-参考)
- [许可证](#许可证)

## ✨ 特性

- ⚡️ 使用粒子系统实现实时风场可视化
- 🚀 GPU 加速的粒子计算和渲染
- 🎨 可自定义粒子外观和行为
- 🏔️ 支持地形遮挡，粒子会被地形阻挡

## 📦 安装

```bash
pnpm add cesium-wind-layer
```

## 🚀 使用方法

### 基础示例

```typescript
import { Viewer } from 'cesium';
import { WindLayer } from 'cesium-wind-layer';

// 创建 Cesium viewer
const viewer = new Viewer('cesiumContainer');

// 准备风场数据
const windData = {
  u: {
    array: Float32Array,  // 风速的 U 分量
    min: number,         // 可选：最小值
    max: number          // 可选：最大值
  },
  v: {
    array: Float32Array,  // 风速的 V 分量
    min: number,         // 可选：最小值
    max: number          // 可选：最大值
  },
  width: number,         // 数据网格宽度
  height: number,        // 数据网格高度
  bounds: {
    west: number,        // 西边界（经度）
    south: number,       // 南边界（纬度）
    east: number,        // 东边界（经度）
    north: number        // 北边界（纬度）
  }
};

// 使用配置创建风场图层
const windLayer = new WindLayer(viewer, windData, {
  particlesTextureSize: 100,          // 粒子系统的纹理大小
  particleHeight: 1000,               // 粒子距地面高度
  lineWidth: { min: 1, max: 2 },      // 粒子轨迹宽度范围
  lineLength: { min: 20, max: 100 },  // 粒子轨迹长度范围
  speedFactor: 1.0,                   // 速度倍数
  colors: ['white'],                  // 粒子颜色
  flipY: false,                       // 是否翻转 Y 坐标
  domain: undefined,                  // 速度渲染范围
  displayRange: undefined,            // 速度显示范围
  dynamic: true                       // 是否启用动态粒子动画
});
```

## 📖 API 参考

### WindLayer

风场可视化的主类。

#### 构造函数选项

```typescript
interface WindLayerOptions {
  particlesTextureSize: number;              // 粒子纹理大小，决定粒子最大数量（size * size）（默认：100）
  particleHeight: number;                    // 粒子距地面高度（默认：0）
  lineWidth: { min: number; max: number };   // 粒子轨迹宽度范围（默认：{ min: 1, max: 5 }）
  lineLength: { min: number; max: number };  // 粒子轨迹长度范围（默认：{ min: 20, max: 100 }）
  speedFactor: number;                       // 速度倍数（默认：1.0）
  colors: string[];                          // 粒子颜色数组（默认：['white']）
  flipY: boolean;                            // 是否翻转 Y 坐标（默认：false）
  useViewerBounds: boolean;                  // 是否使用视域范围生成粒子（默认：false）
  domain?: {                                 // 速度渲染范围（默认：undefined）
    min?: number;                            // 最小速度值
    max?: number;                            // 最大速度值
  };
  displayRange?: {                           // 速度显示范围（默认：undefined）
    min?: number;                            // 最小速度值
    max?: number;                            // 最大速度值
  };
  dynamic: boolean;                          // 是否启用动态粒子动画（默认：true）
}
```

#### 方法

| 方法 | 描述 |
|--------|-------------|
| `add()` | 将风场图层添加到场景中 |
| `remove()` | 从场景中移除风场图层 |
| `show: boolean` | 获取或设置风场图层的可见性 |
| `updateWindData(data: WindData)` | 更新风场数据 |
| `updateOptions(options: Partial<WindLayerOptions>)` | 更新风场图层的选项 |
| `getDataAtLonLat(lon: number, lat: number): WindDataAtLonLat \| null` | 获取指定经纬度的风场数据，返回原始值和插值结果。如果坐标超出范围则返回 null |
| `zoomTo(duration?: number)` | 缩放相机以适应风场范围 |
| `isDestroyed(): boolean` | 检查风场图层是否已被销毁 |
| `destroy()` | 清理资源并销毁风场图层 |

## 🎥 在线演示

https://github.com/user-attachments/assets/64be8661-a080-4318-8b17-4931670570f1

你也可以尝试 [在线演示](https://cesium-wind-layer.opendde.com/) 或查看 [示例代码](../../example)。

## 📄 许可证

[MIT](/LICENSE)
