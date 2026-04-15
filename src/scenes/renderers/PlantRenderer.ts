// src/scenes/renderers/PlantRenderer.ts

const TWO_PI = Math.PI * 2
const DEAD_TINT = '#666666'

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, alive: boolean,
  bounceOffsetY: number,
): void {
  const cy = y + bounceOffsetY
  const fillColor = alive ? color : DEAD_TINT
  const alpha = alive ? 1.0 : 0.3

  ctx.save()
  ctx.globalAlpha = alpha

  // Stem: narrow rectangle from body center-bottom to frame bottom
  const stemW = w * 0.15
  const stemH = h * 0.45
  const stemX = x + (w - stemW) / 2
  const stemY = cy + h * 0.55
  ctx.fillStyle = alive ? '#2d8a2d' : '#555555'
  ctx.fillRect(stemX, stemY, stemW, stemH)

  // Leaves: two small ellipses on each side of stem at midpoint
  const leafMidY = stemY + stemH * 0.4
  ctx.fillStyle = alive ? '#3aaf3a' : '#555555'
  ctx.beginPath()
  ctx.ellipse(stemX - w * 0.12, leafMidY, w * 0.15, h * 0.08, -0.3, 0, TWO_PI)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(stemX + stemW + w * 0.12, leafMidY, w * 0.15, h * 0.08, 0.3, 0, TWO_PI)
  ctx.fill()

  // Head: large ellipse, plant's main body color
  const headW = w * 0.7
  const headH = h * 0.5
  const headCX = x + w / 2
  const headCY = cy + h * 0.3
  ctx.fillStyle = fillColor
  ctx.beginPath()
  ctx.ellipse(headCX, headCY, headW / 2, headH / 2, 0, 0, TWO_PI)
  ctx.fill()
  // Subtle outline
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(headCX, headCY, headW / 2, headH / 2, 0, 0, TWO_PI)
  ctx.stroke()

  // Eyes
  const eyeSpacing = headW * 0.22
  const eyeY = headCY - headH * 0.08
  const eyeRadius = Math.max(2, headW * 0.09)
  const pupilRadius = eyeRadius * 0.5

  if (alive) {
    // White sclera
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(headCX - eyeSpacing, eyeY, eyeRadius, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(headCX + eyeSpacing, eyeY, eyeRadius, 0, TWO_PI)
    ctx.fill()
    // Black pupils (slightly offset right for personality)
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(headCX - eyeSpacing + 1, eyeY, pupilRadius, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(headCX + eyeSpacing + 1, eyeY, pupilRadius, 0, TWO_PI)
    ctx.fill()
  } else {
    // Dead: X eyes
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1.5
    const xSize = eyeRadius * 0.7
    for (const ex of [headCX - eyeSpacing, headCX + eyeSpacing]) {
      ctx.beginPath()
      ctx.moveTo(ex - xSize, eyeY - xSize)
      ctx.lineTo(ex + xSize, eyeY + xSize)
      ctx.moveTo(ex + xSize, eyeY - xSize)
      ctx.lineTo(ex - xSize, eyeY + xSize)
      ctx.stroke()
    }
  }

  // Mouth
  const mouthY = headCY + headH * 0.15
  ctx.strokeStyle = alive ? '#000000' : '#333333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (alive) {
    ctx.arc(headCX, mouthY, headW * 0.12, 0.1, Math.PI - 0.1)
  } else {
    ctx.arc(headCX, mouthY + headH * 0.1, headW * 0.1, Math.PI + 0.2, -0.2)
  }
  ctx.stroke()

  ctx.restore()
}
