// Keyboard layout: 4 rows (numbers + QWERTY)
const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

// Row horizontal offsets in key-width units (staggered layout)
const ROW_OFFSETS = [0, 0.25, 0.6, 1.1]

// 8 finger zones: 0=left pinky → 7=right pinky
const FINGER_ZONE: Readonly<Record<string, number>> = {
  '1': 0, 'Q': 0, 'A': 0, 'Z': 0,
  '2': 1, 'W': 1, 'S': 1, 'X': 1,
  '3': 2, 'E': 2, 'D': 2, 'C': 2,
  '4': 3, '5': 3, 'R': 3, 'T': 3, 'F': 3, 'G': 3, 'V': 3, 'B': 3,
  '6': 4, '7': 4, 'Y': 4, 'U': 4, 'H': 4, 'J': 4, 'N': 4, 'M': 4,
  '8': 5, 'I': 5, 'K': 5,
  '9': 6, 'O': 6, 'L': 6,
  '0': 7, 'P': 7,
}

// 8 colors for 8 fingers (left→right: pinky→index, index→pinky)
const ZONE_COLORS = [
  '#FF6B6B', // left pinky - red
  '#FFA94D', // left ring - orange
  '#FFD93D', // left middle - yellow
  '#69DB7C', // left index - green
  '#4DABF7', // right index - blue
  '#748FFC', // right middle - indigo
  '#CC5DE8', // right ring - purple
  '#F06595', // right pinky - pink
]

/**
 * Render a virtual keyboard in the given canvas area.
 * @param highlightKeys - Keys to highlight (case-insensitive).
 */
export function renderVirtualKeyboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  highlightKeys: readonly string[],
): void {
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.fillRect(x, y, width, height)

  const highlightSet = new Set(highlightKeys.map(k => k.toUpperCase()))

  const padding = 8
  const gap = 3
  const maxKeysPerRow = 10
  const keyW = (width - padding * 2 - gap * (maxKeysPerRow - 1)) / (maxKeysPerRow + 1)
  const keyH = (height - padding * 2 - gap * 3) / 4

  for (let row = 0; row < ROWS.length; row++) {
    const keys = ROWS[row]
    const offsetPx = ROW_OFFSETS[row] * (keyW + gap)
    const rowY = y + padding + row * (keyH + gap)

    // Center the row accounting for offset
    const totalRowW = keys.length * keyW + (keys.length - 1) * gap
    const rowX = x + (width - totalRowW) / 2 + offsetPx / 2

    for (let col = 0; col < keys.length; col++) {
      const key = keys[col]
      const kx = rowX + col * (keyW + gap)
      const ky = rowY
      const zone = FINGER_ZONE[key] ?? 0
      const color = ZONE_COLORS[zone]
      const isHl = highlightSet.has(key)

      // Key background
      if (isHl) {
        ctx.fillStyle = color
        ctx.globalAlpha = 1.0
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.25
      }
      ctx.beginPath()
      ctx.roundRect(kx, ky, keyW, keyH, 4)
      ctx.fill()
      ctx.globalAlpha = 1.0

      // Highlight border
      if (isHl) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(kx, ky, keyW, keyH, 4)
        ctx.stroke()
      }

      // Key label
      ctx.fillStyle = isHl ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'
      ctx.font = `bold ${Math.max(10, Math.floor(keyH * 0.5))}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key, kx + keyW / 2, ky + keyH / 2)
    }
  }

  // Reset text baseline
  ctx.textBaseline = 'alphabetic'
}
