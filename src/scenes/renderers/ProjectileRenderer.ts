import type { Element } from '../../game/types'

const TWO_PI = Math.PI * 2

const MAX_TRAIL = 4

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
  electric: '#9b59b6',
  stun: '#f1c40f',
  knockback: '#e67e22',
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  element: Element,
  trail: readonly { x: number; y: number }[],
  trailCount: number,
  trailIndex: number,
  rotation: number,
): void {
  const color = ELEMENT_COLORS[element]
  const cx = x + w / 2
  const cy = y + h / 2

  // Draw trail (behind projectile) for non-normal elements
  if (trailCount > 0 && element !== 'normal') {
    for (let i = 0; i < trailCount; i++) {
      // Read trail entries in chronological order (oldest first)
      const idx = ((trailIndex - trailCount + i) % MAX_TRAIL + MAX_TRAIL) % MAX_TRAIL
      const t = trail[idx]
      const age = (trailCount - i) / trailCount  // 1.0 (oldest) to near-0 (newest)
      ctx.globalAlpha = 0.5 * (1 - age)
      ctx.fillStyle = color
      const trailSize = (w / 2) * (1 - age * 0.5)
      ctx.beginPath()
      ctx.arc(t.x + w / 2, t.y + h / 2, trailSize, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Draw body by element
  ctx.fillStyle = color
  switch (element) {
    case 'normal':
      ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, TWO_PI); ctx.fill()
      break

    case 'ice':
      // Diamond (rotated square)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4)
      ctx.fillRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7)
      ctx.restore()
      break

    case 'fire':
      // Circle + flame on top
      ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, TWO_PI); ctx.fill()
      ctx.fillStyle = '#ff4500'
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.3, cy - h * 0.2)
      ctx.quadraticCurveTo(cx, cy - h, cx + w * 0.1, cy - h * 0.3)
      ctx.quadraticCurveTo(cx + w * 0.2, cy - h * 0.8, cx + w * 0.3, cy - h * 0.2)
      ctx.closePath(); ctx.fill()
      break

    case 'electric':
      // Small circle + zigzag lightning bolts
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.3, 0, TWO_PI); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const angle = rotation + i * (TWO_PI / 3)
        const dx = Math.cos(angle), dy = Math.sin(angle)
        const len = w * 0.6
        ctx.beginPath()
        ctx.moveTo(cx + dx * w * 0.3, cy + dy * w * 0.3)
        ctx.lineTo(cx + dx * len * 0.5 + (Math.random() - 0.5) * 4, cy + dy * len * 0.5 + (Math.random() - 0.5) * 4)
        ctx.lineTo(cx + dx * len, cy + dy * len)
        ctx.stroke()
      }
      break

    case 'stun':
      // Rotating star
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation)
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + i * (TWO_PI / 5)
        const innerAngle = outerAngle + TWO_PI / 10
        ctx.lineTo(Math.cos(outerAngle) * w * 0.5, Math.sin(outerAngle) * h * 0.5)
        ctx.lineTo(Math.cos(innerAngle) * w * 0.2, Math.sin(innerAngle) * h * 0.2)
      }
      ctx.closePath(); ctx.fill()
      ctx.restore()
      break

    case 'knockback':
      // Large circle + shockwave rings
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.4, 0, TWO_PI); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(cx, cy, w * 0.7, 0, TWO_PI); ctx.stroke()
      ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(cx, cy, w, 0, TWO_PI); ctx.stroke()
      ctx.globalAlpha = 1
      break
  }
}
