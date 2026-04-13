// src/engine/__tests__/EntityManager.test.ts
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../EntityManager'
import { RenderLayer } from '../types'
import type { Entity } from '../types'

let entityIdCounter = 0

function createEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `entity-${entityIdCounter++}`,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    active: true,
    layer: RenderLayer.Entity,
    tags: new Set(),
    update(_dt: number) {},
    render(_ctx: CanvasRenderingContext2D) {},
    ...overrides,
  }
}

describe('EntityManager', () => {
  it('add 后 update 会调用实体的 update', () => {
    const mgr = new EntityManager()
    let updated = false
    const entity = createEntity({ update: () => { updated = true } })

    mgr.add(entity)
    mgr.update(16)

    expect(updated).toBe(true)
  })

  it('remove 后实体不再被 update', () => {
    const mgr = new EntityManager()
    let updateCount = 0
    const entity = createEntity({ update: () => { updateCount++ } })

    mgr.add(entity)
    mgr.update(16)
    mgr.remove(entity)
    mgr.update(16)

    expect(updateCount).toBe(1)
  })

  it('count 返回活跃实体数', () => {
    const mgr = new EntityManager()
    const e1 = createEntity()
    const e2 = createEntity()

    mgr.add(e1)
    mgr.add(e2)
    mgr.update(0)

    expect(mgr.count).toBe(2)

    mgr.remove(e1)
    mgr.update(0)

    expect(mgr.count).toBe(1)
  })

  it('getByTag 按标签过滤实体', () => {
    const mgr = new EntityManager()
    const e1 = createEntity({ tags: new Set(['enemy']) })
    const e2 = createEntity({ tags: new Set(['friendly']) })
    const e3 = createEntity({ tags: new Set(['enemy']) })

    mgr.add(e1)
    mgr.add(e2)
    mgr.add(e3)
    mgr.update(0)

    const enemies = mgr.getByTag('enemy')
    expect(enemies).toHaveLength(2)
  })

  it('clear 清空所有实体', () => {
    const mgr = new EntityManager()
    mgr.add(createEntity())
    mgr.add(createEntity())
    mgr.update(0)

    mgr.clear()

    expect(mgr.count).toBe(0)
  })

  it('在 update 遍历中 add 的实体在下一帧生效', () => {
    const mgr = new EntityManager()
    const laterEntity = createEntity()
    let laterUpdated = false
    laterEntity.update = () => { laterUpdated = true }

    const firstEntity = createEntity({
      update: () => { mgr.add(laterEntity) }
    })

    mgr.add(firstEntity)
    mgr.update(16)

    expect(laterUpdated).toBe(false)

    mgr.update(16)

    expect(laterUpdated).toBe(true)
  })
})
