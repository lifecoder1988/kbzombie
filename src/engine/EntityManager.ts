// src/engine/EntityManager.ts
import type { Entity } from './types'

export class EntityManager {
  private entities: Entity[] = []
  private toAdd: Entity[] = []

  /** 添加实体（在当前帧末尾实际加入，避免遍历中修改列表） */
  add(entity: Entity): void {
    this.toAdd.push(entity)
  }

  /** 移除实体（标记为 inactive，下次 cleanup 时删除） */
  remove(entity: Entity): void {
    entity.active = false
  }

  /** 更新所有活跃实体 */
  update(dt: number): void {
    this.flush()
    for (let i = 0; i < this.entities.length; i++) {
      if (this.entities[i].active) {
        this.entities[i].update(dt)
      }
    }
    this.cleanup()
  }

  /** 按层级顺序渲染所有活跃实体 */
  render(ctx: CanvasRenderingContext2D): void {
    const sorted = this.entities.filter(e => e.active)
    sorted.sort((a, b) => a.layer - b.layer)
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].render(ctx)
    }
  }

  /** 按 tag 查询实体 */
  getByTag(tag: string): Entity[] {
    return this.entities.filter(e => e.active && e.tags.has(tag))
  }

  /** 获取所有活跃实体数量 */
  get count(): number {
    return this.entities.filter(e => e.active).length
  }

  /** 清空所有实体 */
  clear(): void {
    this.entities.length = 0
    this.toAdd.length = 0
  }

  private flush(): void {
    if (this.toAdd.length > 0) {
      for (let i = 0; i < this.toAdd.length; i++) {
        this.entities.push(this.toAdd[i])
      }
      this.toAdd.length = 0
    }
  }

  private cleanup(): void {
    let write = 0
    for (let read = 0; read < this.entities.length; read++) {
      if (this.entities[read].active) {
        this.entities[write] = this.entities[read]
        write++
      }
    }
    this.entities.length = write
  }
}
