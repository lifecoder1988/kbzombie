const GRASS_LIGHT = '#3d6b2e'
const GRASS_DARK = '#2d5a1e'
const PLANT_ZONE = '#1e4a15'
const DIRT_COLOR = '#8B6914'
const DIRT_EDGE = '#5a4510'

export function drawBattlefield(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  plantZoneWidth: number,
): void {
  // 1. Grass checkerboard covering entire area
  const cellW = 60
  const cellH = 60
  const cols = Math.ceil(width / cellW)
  const rows = Math.ceil(height / cellH)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? GRASS_LIGHT : GRASS_DARK
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH)
    }
  }

  // 2. Plant zone darker overlay (left side)
  ctx.fillStyle = PLANT_ZONE
  ctx.fillRect(0, 0, plantZoneWidth, height)

  // 3. Dirt divider at plant zone right edge
  const dirtX = plantZoneWidth - 4
  ctx.fillStyle = DIRT_EDGE
  ctx.fillRect(dirtX - 1, 0, 1, height)
  ctx.fillStyle = DIRT_COLOR
  ctx.fillRect(dirtX, 0, 8, height)
  ctx.fillStyle = DIRT_EDGE
  ctx.fillRect(dirtX + 8, 0, 1, height)
}
