// src/scenes/renderers/PlantRenderer.ts

const TWO_PI = Math.PI * 2
const DEAD_TINT = '#666666'

// Per-plant fixed colors (not cycling by index)
const PLANT_THEME: Record<string, string> = {
  peashooter: '#22cc22',
  snow_pea: '#66ccee',
  repeater: '#22aa22',
  torchwood: '#cc6622',
  cactus: '#339933',
  lightning_reed: '#cccc22',
  kernel_pult: '#ddaa33',
  fume_shroom: '#9944cc',
  cattail: '#44aaff',
  hurricane_flower: '#ee7733',
  melon_pult: '#44bb44',
  starfruit: '#eecc00',
}

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, alive: boolean,
  bounceOffsetY: number,
  plantId?: string,
): void {
  const cy = y + bounceOffsetY

  // Shadow ellipse at plant base
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h, w * 0.35, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const themeColor = plantId && PLANT_THEME[plantId] ? PLANT_THEME[plantId] : color
  const fillColor = alive ? themeColor : DEAD_TINT
  const alpha = alive ? 1.0 : 0.3
  const headCX = x + w / 2
  const headW = w * 0.7
  const headH = h * 0.5
  const headCY = cy + h * 0.3

  ctx.save()
  ctx.globalAlpha = alpha

  // Stem (common base)
  const stemW = w * 0.15
  const stemH = h * 0.45
  const stemX = x + (w - stemW) / 2
  const stemY = cy + h * 0.55
  ctx.fillStyle = alive ? '#2d8a2d' : '#555555'
  ctx.fillRect(stemX, stemY, stemW, stemH)

  // Leaves (common base, some plants override)
  if (plantId !== 'torchwood' && plantId !== 'fume_shroom') {
    const leafMidY = stemY + stemH * 0.4
    ctx.fillStyle = alive ? '#3aaf3a' : '#555555'
    ctx.beginPath()
    ctx.ellipse(stemX - w * 0.12, leafMidY, w * 0.15, h * 0.08, -0.3, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(stemX + stemW + w * 0.12, leafMidY, w * 0.15, h * 0.08, 0.3, 0, TWO_PI)
    ctx.fill()
  }

  // Dispatch per-plant head shape
  switch (plantId) {
    case 'peashooter':
    case 'snow_pea':
    case 'repeater':
      drawShooterHead(ctx, headCX, headCY, headW, headH, fillColor, alive, plantId)
      break
    case 'torchwood':
      drawTorchwoodHead(ctx, headCX, headCY, headW, headH, fillColor, alive, stemX, stemW, stemY, stemH, w)
      break
    case 'cactus':
      drawCactusHead(ctx, headCX, headCY, headW, headH, fillColor, alive, x, w, cy, h)
      break
    case 'lightning_reed':
      drawLightningReedHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    case 'kernel_pult':
      drawKernelPultHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    case 'fume_shroom':
      drawFumeShroomHead(ctx, headCX, headCY, headW, headH, fillColor, alive, stemX, stemW, stemY, stemH, w, cy, h)
      break
    case 'cattail':
      drawCattailHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    case 'hurricane_flower':
      drawHurricaneFlowerHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    case 'melon_pult':
      drawMelonPultHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    case 'starfruit':
      drawStarfruitHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
    default:
      drawDefaultHead(ctx, headCX, headCY, headW, headH, fillColor, alive)
      break
  }

  ctx.restore()
}

// ─── Common parts ───

function drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, headW: number, headH: number, alive: boolean): void {
  const eyeSpacing = headW * 0.22
  const eyeY = cy - headH * 0.08
  const eyeRadius = Math.max(2, headW * 0.09)
  const pupilRadius = eyeRadius * 0.5

  if (alive) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, eyeRadius, 0, TWO_PI); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, eyeRadius, 0, TWO_PI); ctx.fill()
    ctx.fillStyle = '#000000'
    ctx.beginPath(); ctx.arc(cx - eyeSpacing + 1, eyeY, pupilRadius, 0, TWO_PI); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + eyeSpacing + 1, eyeY, pupilRadius, 0, TWO_PI); ctx.fill()
  } else {
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1.5
    const xSize = eyeRadius * 0.7
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      ctx.beginPath()
      ctx.moveTo(ex - xSize, eyeY - xSize); ctx.lineTo(ex + xSize, eyeY + xSize)
      ctx.moveTo(ex + xSize, eyeY - xSize); ctx.lineTo(ex - xSize, eyeY + xSize)
      ctx.stroke()
    }
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, headW: number, headH: number, alive: boolean): void {
  const mouthY = cy + headH * 0.15
  ctx.strokeStyle = alive ? '#000000' : '#333333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (alive) {
    ctx.arc(cx, mouthY, headW * 0.12, 0.1, Math.PI - 0.1)
  } else {
    ctx.arc(cx, mouthY + headH * 0.1, headW * 0.1, Math.PI + 0.2, -0.2)
  }
  ctx.stroke()
}

function drawHeadEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(cx, cy, hw / 2, hh / 2, 0, 0, TWO_PI); ctx.fill()
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(cx, cy, hw / 2, hh / 2, 0, 0, TWO_PI); ctx.stroke()
}

// ─── Default (generic plant) ───

function drawDefaultHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  drawHeadEllipse(ctx, cx, cy, hw, hh, color, alive)
  drawEyes(ctx, cx, cy, hw, hh, alive)
  drawMouth(ctx, cx, cy, hw, hh, alive)
}

// ─── Shooter family (peashooter, snow_pea, repeater) ───
// Round head + tube mouth pointing right

function drawShooterHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean, id: string): void {
  drawHeadEllipse(ctx, cx, cy, hw, hh, color, alive)
  drawEyes(ctx, cx, cy, hw, hh, alive)

  // Tube mouth (cannon) pointing right
  const tubeW = hw * 0.35
  const tubeH = hh * 0.2
  const tubeX = cx + hw * 0.2
  const tubeY = cy + hh * 0.05
  ctx.fillStyle = alive ? darken(color, 0.3) : '#444444'
  ctx.beginPath()
  ctx.roundRect(tubeX, tubeY - tubeH / 2, tubeW, tubeH, tubeH * 0.3)
  ctx.fill()

  // Snow pea: ice crystal on head
  if (id === 'snow_pea' && alive) {
    ctx.strokeStyle = '#aaddff'
    ctx.lineWidth = 1.5
    const sx = cx, sy = cy - hh * 0.35
    ctx.beginPath()
    ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5)
    ctx.moveTo(sx - 4, sy - 3); ctx.lineTo(sx + 4, sy + 3)
    ctx.moveTo(sx + 4, sy - 3); ctx.lineTo(sx - 4, sy + 3)
    ctx.stroke()
  }

  // Repeater: double tube
  if (id === 'repeater') {
    const tube2Y = tubeY - tubeH * 1.2
    ctx.fillStyle = alive ? darken(color, 0.3) : '#444444'
    ctx.beginPath()
    ctx.roundRect(tubeX, tube2Y - tubeH / 2, tubeW * 0.8, tubeH, tubeH * 0.3)
    ctx.fill()
  }
}

// ─── Torchwood: tree stump with flame ───

function drawTorchwoodHead(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number,
  color: string, alive: boolean,
  _stemX: number, _stemW: number, _stemY: number, _stemH: number, w: number,
): void {
  // Thick trunk instead of thin stem — draw over it
  const trunkW = w * 0.35
  const trunkX = cx - trunkW / 2
  ctx.fillStyle = alive ? '#8B5A2B' : '#555555'
  ctx.fillRect(trunkX, cy - hh * 0.1, trunkW, hh * 0.8)

  // Stump face area (rough circle)
  drawHeadEllipse(ctx, cx, cy, hw * 0.9, hh * 0.9, color, alive)

  // Flame on top
  if (alive) {
    ctx.fillStyle = '#ff6622'
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.2, cy - hh * 0.3)
    ctx.quadraticCurveTo(cx - hw * 0.05, cy - hh * 0.8, cx, cy - hh * 0.35)
    ctx.quadraticCurveTo(cx + hw * 0.05, cy - hh * 0.9, cx + hw * 0.2, cy - hh * 0.3)
    ctx.fill()
    ctx.fillStyle = '#ffcc00'
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.1, cy - hh * 0.3)
    ctx.quadraticCurveTo(cx, cy - hh * 0.6, cx + hw * 0.1, cy - hh * 0.3)
    ctx.fill()
  }

  drawEyes(ctx, cx, cy, hw * 0.8, hh * 0.8, alive)
}

// ─── Cactus: tall body with spikes ───

function drawCactusHead(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number,
  color: string, alive: boolean, _x: number, _w: number, _bodyY: number, _bodyH: number,
): void {
  // Tall oval body
  const cactusH = hh * 1.3
  drawHeadEllipse(ctx, cx, cy + hh * 0.1, hw * 0.8, cactusH, color, alive)

  // Small arm bumps on sides
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(cx - hw * 0.4, cy + hh * 0.05, hw * 0.2, hh * 0.15, -0.3, 0, TWO_PI); ctx.fill()
  ctx.beginPath(); ctx.ellipse(cx + hw * 0.4, cy - hh * 0.05, hw * 0.18, hh * 0.13, 0.3, 0, TWO_PI); ctx.fill()

  // Spikes
  if (alive) {
    ctx.strokeStyle = '#224422'
    ctx.lineWidth = 1
    const spikes = [[-0.3, -0.2], [0.3, -0.15], [-0.15, -0.4], [0.2, -0.35], [0, -0.5], [-0.4, 0.1], [0.4, 0.05]]
    for (const [sx, sy] of spikes) {
      const bx = cx + hw * sx
      const by = cy + hh * sy
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + (sx > 0 ? 4 : -4), by - 5)
      ctx.stroke()
    }
  }

  drawEyes(ctx, cx, cy, hw * 0.7, hh * 0.7, alive)
  drawMouth(ctx, cx, cy, hw * 0.7, hh * 0.7, alive)
}

// ─── Lightning Reed: zigzag antenna ───

function drawLightningReedHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  drawHeadEllipse(ctx, cx, cy, hw, hh, color, alive)

  // Lightning bolt antenna on top
  if (alive) {
    ctx.strokeStyle = '#ffee00'
    ctx.lineWidth = 2
    const top = cy - hh * 0.4
    ctx.beginPath()
    ctx.moveTo(cx, cy - hh * 0.25)
    ctx.lineTo(cx - 3, top + 6)
    ctx.lineTo(cx + 3, top + 3)
    ctx.lineTo(cx, top - 5)
    ctx.stroke()

    // Small spark dot
    ctx.fillStyle = '#ffee00'
    ctx.beginPath(); ctx.arc(cx, top - 6, 2, 0, TWO_PI); ctx.fill()
  }

  drawEyes(ctx, cx, cy, hw, hh, alive)
  drawMouth(ctx, cx, cy, hw, hh, alive)
}

// ─── Kernel Pult: corn cob shape ───

function drawKernelPultHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  // Tall corn cob shape (rounded rectangle)
  const cobW = hw * 0.6
  const cobH = hh * 1.1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(cx - cobW / 2, cy - cobH / 2, cobW, cobH, cobW * 0.3)
  ctx.fill()
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(cx - cobW / 2, cy - cobH / 2, cobW, cobH, cobW * 0.3)
  ctx.stroke()

  // Corn kernel dots
  if (alive) {
    ctx.fillStyle = '#cc8800'
    const rows = 3, cols = 2
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kx = cx + (c - 0.5) * cobW * 0.35
        const ky = cy + (r - 1) * cobH * 0.25
        ctx.beginPath(); ctx.arc(kx, ky, 2, 0, TWO_PI); ctx.fill()
      }
    }
  }

  // Husk leaves on top
  ctx.fillStyle = alive ? '#55aa22' : '#555555'
  ctx.beginPath()
  ctx.ellipse(cx - 3, cy - cobH / 2 - 2, 4, 8, -0.3, 0, TWO_PI)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 3, cy - cobH / 2 - 2, 4, 7, 0.3, 0, TWO_PI)
  ctx.fill()

  drawEyes(ctx, cx, cy, hw * 0.5, hh * 0.5, alive)
}

// ─── Fume-shroom: mushroom cap with gas cloud ───

function drawFumeShroomHead(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number,
  color: string, alive: boolean,
  _stemX: number, _stemW: number, _stemY: number, _stemH: number, _w: number, _bodyY: number, _bodyH: number,
): void {
  // Mushroom cap (wide dome)
  const capW = hw * 1.2
  const capH = hh * 0.7
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(cx, cy - capH * 0.1, capW / 2, capH / 2, 0, Math.PI, TWO_PI)
  ctx.fill()
  // Cap spots
  if (alive) {
    ctx.fillStyle = '#7733aa'
    ctx.beginPath(); ctx.arc(cx - capW * 0.15, cy - capH * 0.3, 3, 0, TWO_PI); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + capW * 0.2, cy - capH * 0.25, 2.5, 0, TWO_PI); ctx.fill()
  }

  // Gas puff to the right
  if (alive) {
    ctx.fillStyle = 'rgba(150, 100, 200, 0.3)'
    ctx.beginPath(); ctx.arc(cx + hw * 0.5, cy, hw * 0.15, 0, TWO_PI); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + hw * 0.65, cy - 3, hw * 0.1, 0, TWO_PI); ctx.fill()
  }

  drawEyes(ctx, cx, cy - capH * 0.05, hw * 0.6, hh * 0.5, alive)
}

// ─── Cattail: cat face with tail ───

function drawCattailHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  drawHeadEllipse(ctx, cx, cy, hw, hh, color, alive)

  // Cat ears (triangles on top)
  ctx.fillStyle = color
  const earH = hh * 0.35
  // Left ear
  ctx.beginPath()
  ctx.moveTo(cx - hw * 0.25, cy - hh * 0.3)
  ctx.lineTo(cx - hw * 0.35, cy - hh * 0.3 - earH)
  ctx.lineTo(cx - hw * 0.1, cy - hh * 0.3)
  ctx.closePath(); ctx.fill()
  // Right ear
  ctx.beginPath()
  ctx.moveTo(cx + hw * 0.1, cy - hh * 0.3)
  ctx.lineTo(cx + hw * 0.35, cy - hh * 0.3 - earH)
  ctx.lineTo(cx + hw * 0.25, cy - hh * 0.3)
  ctx.closePath(); ctx.fill()

  // Inner ear pink
  if (alive) {
    ctx.fillStyle = '#ffaaaa'
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.22, cy - hh * 0.3)
    ctx.lineTo(cx - hw * 0.3, cy - hh * 0.3 - earH * 0.6)
    ctx.lineTo(cx - hw * 0.14, cy - hh * 0.3)
    ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx + hw * 0.14, cy - hh * 0.3)
    ctx.lineTo(cx + hw * 0.3, cy - hh * 0.3 - earH * 0.6)
    ctx.lineTo(cx + hw * 0.22, cy - hh * 0.3)
    ctx.closePath(); ctx.fill()
  }

  drawEyes(ctx, cx, cy, hw, hh, alive)

  // Cat nose (small triangle)
  ctx.fillStyle = alive ? '#ff8888' : '#555555'
  const noseY = cy + hh * 0.08
  ctx.beginPath()
  ctx.moveTo(cx, noseY - 2)
  ctx.lineTo(cx - 3, noseY + 2)
  ctx.lineTo(cx + 3, noseY + 2)
  ctx.closePath(); ctx.fill()

  // Whiskers
  if (alive) {
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 0.8
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + side * 4, noseY + 1); ctx.lineTo(cx + side * hw * 0.4, noseY - 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + side * 4, noseY + 2); ctx.lineTo(cx + side * hw * 0.38, noseY + 4); ctx.stroke()
    }
  }
}

// ─── Hurricane Flower: spiral petals ───

function drawHurricaneFlowerHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  // Petals around center (5 petals in a circle)
  const petalR = hw * 0.2
  const centerR = hw * 0.25
  ctx.fillStyle = color
  for (let i = 0; i < 5; i++) {
    const angle = i * (TWO_PI / 5) - Math.PI / 2
    const px = cx + Math.cos(angle) * centerR
    const py = cy + Math.sin(angle) * centerR * (hh / hw)
    ctx.beginPath(); ctx.arc(px, py, petalR, 0, TWO_PI); ctx.fill()
  }

  // Center circle
  ctx.fillStyle = alive ? '#ffaa33' : '#555555'
  ctx.beginPath(); ctx.arc(cx, cy, centerR * 0.6, 0, TWO_PI); ctx.fill()

  // Spiral mark in center
  if (alive) {
    ctx.strokeStyle = '#dd7700'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, centerR * 0.3, 0, Math.PI * 1.5)
    ctx.stroke()
  }

  drawEyes(ctx, cx, cy, hw * 0.4, hh * 0.4, alive)
}

// ─── Melon Pult: big round melon ───

function drawMelonPultHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  // Big round melon
  const melonR = Math.min(hw, hh) * 0.55
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(cx, cy, melonR, 0, TWO_PI); ctx.fill()
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, melonR, 0, TWO_PI); ctx.stroke()

  // Melon stripes
  if (alive) {
    ctx.strokeStyle = '#228822'
    ctx.lineWidth = 1.5
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.arc(cx + i * melonR * 0.35, cy, melonR * 0.9, -0.5, 0.5)
      ctx.stroke()
    }
  }

  // Small leaf on top
  ctx.fillStyle = alive ? '#55aa22' : '#555555'
  ctx.beginPath()
  ctx.ellipse(cx, cy - melonR - 3, 5, 3, 0, 0, TWO_PI)
  ctx.fill()

  drawEyes(ctx, cx, cy - melonR * 0.1, hw * 0.5, hh * 0.5, alive)
  drawMouth(ctx, cx, cy - melonR * 0.1, hw * 0.5, hh * 0.5, alive)
}

// ─── Starfruit: star shape ───

function drawStarfruitHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string, alive: boolean): void {
  const r = Math.min(hw, hh) * 0.5
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + i * (TWO_PI / 5)
    const innerAngle = outerAngle + TWO_PI / 10
    ctx.lineTo(cx + Math.cos(outerAngle) * r, cy + Math.sin(outerAngle) * r)
    ctx.lineTo(cx + Math.cos(innerAngle) * r * 0.45, cy + Math.sin(innerAngle) * r * 0.45)
  }
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.stroke()

  drawEyes(ctx, cx, cy, hw * 0.35, hh * 0.35, alive)
  drawMouth(ctx, cx, cy, hw * 0.3, hh * 0.3, alive)
}

// ─── Utility ───

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`
}
