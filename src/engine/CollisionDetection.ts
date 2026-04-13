// src/engine/CollisionDetection.ts
import type { Rect } from './types'

/** AABB 矩形重叠判定。边界接触不算碰撞，零面积矩形不碰撞。 */
export function intersects(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false
  }
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
