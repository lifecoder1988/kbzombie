// src/engine/types.ts

/** 可更新的对象 */
export interface Updatable {
  update(dt: number): void
}

/** 可渲染的对象 */
export interface Renderable {
  render(ctx: CanvasRenderingContext2D): void
}

/** 游戏实体 */
export interface Entity extends Updatable, Renderable {
  readonly id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  layer: RenderLayer
  tags: ReadonlySet<string>
}

/** 渲染层级，数值越大越在上面 */
export enum RenderLayer {
  Background = 0,
  Entity = 1,
  Effect = 2,
  UI = 3,
}

/** 场景接口 */
export interface Scene {
  readonly name: string
  enter(): void
  exit(): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  handleInput?(event: InputEvent): void
}

/** 引擎层的输入事件（与浏览器 KeyboardEvent 解耦） */
export interface InputEvent {
  readonly key: string
  readonly type: 'keydown' | 'keyup'
  readonly timestamp: number
}

/** 输入事件监听器 */
export type InputListener = (event: InputEvent) => void

/** 资源清单 */
export interface AssetManifest {
  images: Record<string, string>   // id → URL
  audio: Record<string, string>    // id → URL
}

/** 已加载的资源集合 */
export interface LoadedAssets {
  images: Map<string, HTMLImageElement>
  audio: Map<string, AudioBuffer>
}

/** 资源加载进度回调 */
export type AssetProgressCallback = (loaded: number, total: number) => void
