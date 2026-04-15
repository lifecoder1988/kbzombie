import { ZombieState } from '../../game/types'
import type { ZombieStatus } from '../../game/types'

const TWO_PI = Math.PI * 2

export function drawZombie(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  type: string, color: string,
  options: {
    flashTimer: number
    walkPhase: number
    state: ZombieState
    statuses: readonly ZombieStatus[]
    statusCount: number
  },
): void {
  const { flashTimer, walkPhase, state, statuses, statusCount } = options
  const flash = flashTimer > 0

  // Layout constants relative to bounding box
  const headR = w * 0.28
  const headCx = x + w * 0.5
  const headCy = y + headR * 1.1
  const bodyTop = headCy + headR * 0.9
  const bodyH = h * 0.38
  const bodyBottom = bodyTop + bodyH
  const legLen = h * 0.22
  const armLen = w * 0.55

  // Type-specific adjustments
  const isFat = type === 'fat'
  const isImp = type === 'imp'
  const bodyW = isFat ? w * 0.7 : isImp ? w * 0.55 : w * 0.5
  const bodyLeft = x + (w - bodyW) / 2
  const legAngleBase = isImp ? 0.45 : 0.3

  // Animation offsets
  let bobY = 0
  let leftLegAngle = 0
  let rightLegAngle = 0
  let armSway = 0

  if (state === ZombieState.Walking) {
    bobY = Math.sin(walkPhase * 2) * 1.5
    const legSwing = Math.sin(walkPhase) * legAngleBase
    leftLegAngle = legSwing
    rightLegAngle = -legSwing
    armSway = Math.sin(walkPhase + 0.5) * 0.15
  } else if (state === ZombieState.Chewing) {
    bobY = Math.sin(walkPhase * 12) * 2
  }

  const drawY = bobY

  ctx.save()
  ctx.translate(0, drawY)

  // --- Legs ---
  ctx.lineCap = 'round'
  const legStartX = [x + w * 0.38, x + w * 0.62]
  const legAngles = [Math.PI / 2 + leftLegAngle, Math.PI / 2 + rightLegAngle]

  for (let li = 0; li < 2; li++) {
    const lx = legStartX[li]
    const ly = bodyBottom
    const la = legAngles[li]
    ctx.strokeStyle = flash ? '#ffffff' : '#3a6b3a'
    ctx.lineWidth = w * 0.12
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(lx + Math.cos(la) * legLen, ly + Math.sin(la) * legLen)
    ctx.stroke()
  }

  // --- Body ---
  if (flash) {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = isFat ? '#6aaa5a' : color
  }
  ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH)

  // --- Arms (zombie-style: extend forward = leftward on screen) ---
  const armY = bodyTop + bodyH * 0.25
  ctx.strokeStyle = flash ? '#ffffff' : '#3a6b3a'
  ctx.lineWidth = w * 0.1
  ctx.lineCap = 'round'

  // Left arm (forward, slightly up)
  const armAngle = Math.PI + armSway
  ctx.beginPath()
  ctx.moveTo(bodyLeft, armY)
  ctx.lineTo(bodyLeft + Math.cos(armAngle - 0.3) * armLen, armY + Math.sin(armAngle - 0.3) * armLen * 0.4)
  ctx.stroke()

  // Right arm (forward, slightly down)
  ctx.beginPath()
  ctx.moveTo(bodyLeft, armY + bodyH * 0.2)
  ctx.lineTo(bodyLeft + Math.cos(armAngle + 0.15) * armLen, armY + bodyH * 0.2 + Math.sin(armAngle + 0.15) * armLen * 0.35)
  ctx.stroke()

  // --- Head ---
  const scaledHeadR = isImp ? headR * 0.85 : headR
  if (flash) {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = '#7aaa7a'
  }
  ctx.beginPath()
  ctx.arc(headCx, headCy, scaledHeadR, 0, TWO_PI)
  ctx.fill()

  // Eyes
  if (!flash) {
    const eyeOffX = scaledHeadR * 0.35
    const eyeOffY = scaledHeadR * 0.1
    const eyeR = scaledHeadR * 0.22
    const pupilR = eyeR * 0.55

    for (let ei = -1; ei <= 1; ei += 2) {
      const ex = headCx + ei * eyeOffX
      const ey = headCy + eyeOffY
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex, ey, eyeR, 0, TWO_PI)
      ctx.fill()
      ctx.fillStyle = '#cc2222'
      ctx.beginPath()
      ctx.arc(ex - eyeR * 0.15, ey + eyeR * 0.1, pupilR, 0, TWO_PI)
      ctx.fill()
    }
  }

  // --- Type decorations ---
  if (!flash) {
    if (type === 'conehead') {
      // Orange trapezoid on top of head
      const coneBottomW = scaledHeadR * 1.4
      const coneTopW = scaledHeadR * 0.5
      const coneH = scaledHeadR * 1.2
      const coneBottomY = headCy - scaledHeadR * 0.7
      const coneTopY = coneBottomY - coneH
      ctx.fillStyle = '#e87a20'
      ctx.beginPath()
      ctx.moveTo(headCx - coneBottomW / 2, coneBottomY)
      ctx.lineTo(headCx + coneBottomW / 2, coneBottomY)
      ctx.lineTo(headCx + coneTopW / 2, coneTopY)
      ctx.lineTo(headCx - coneTopW / 2, coneTopY)
      ctx.closePath()
      ctx.fill()
    } else if (type === 'flag') {
      // Vertical stick + triangular red flag
      const stickX = headCx + scaledHeadR * 0.6
      const stickTopY = headCy - scaledHeadR * 2.2
      const stickBottomY = headCy - scaledHeadR * 0.5
      ctx.strokeStyle = '#8b6914'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(stickX, stickTopY)
      ctx.lineTo(stickX, stickBottomY)
      ctx.stroke()
      const flagLen = scaledHeadR * 1.0
      ctx.fillStyle = '#dd2222'
      ctx.beginPath()
      ctx.moveTo(stickX, stickTopY)
      ctx.lineTo(stickX + flagLen, stickTopY + flagLen * 0.35)
      ctx.lineTo(stickX, stickTopY + flagLen * 0.7)
      ctx.closePath()
      ctx.fill()
    }
  }

  // --- Status overlays ---
  for (let si = 0; si < statusCount; si++) {
    const s = statuses[si]
    if (s.type === 'slow') {
      // Blue semi-transparent overlay on body
      ctx.fillStyle = 'rgba(80, 160, 255, 0.35)'
      ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH)
    } else if (s.type === 'burn') {
      // Small flame shapes around body
      const flameCount = 3
      for (let fi = 0; fi < flameCount; fi++) {
        const fx = bodyLeft + bodyW * ((fi + 0.5) / flameCount)
        const fy = bodyTop - 2
        const wiggle = Math.sin(walkPhase * 4 + fi * 2.1) * 3
        const flameH = h * 0.12
        ctx.fillStyle = fi % 2 === 0 ? 'rgba(255, 120, 0, 0.85)' : 'rgba(255, 60, 0, 0.7)'
        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.quadraticCurveTo(fx + wiggle + 5, fy - flameH * 0.5, fx + wiggle, fy - flameH)
        ctx.quadraticCurveTo(fx + wiggle - 5, fy - flameH * 0.5, fx, fy)
        ctx.fill()
      }
    } else if (s.type === 'stun') {
      // Small stars rotating around the head
      const starCount = 3
      for (let ki = 0; ki < starCount; ki++) {
        const angle = walkPhase * 2 + (ki * TWO_PI) / starCount
        const orbitR = scaledHeadR * 1.4
        const sx = headCx + Math.cos(angle) * orbitR
        const sy = headCy + Math.sin(angle) * orbitR * 0.6
        drawStar(ctx, sx, sy, 4, 3)
      }
    }
  }

  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number): void {
  ctx.fillStyle = '#ffee22'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * TWO_PI) / 5 - Math.PI / 2
    const innerAngle = outerAngle + Math.PI / 5
    if (i === 0) {
      ctx.moveTo(cx + Math.cos(outerAngle) * outerR, cy + Math.sin(outerAngle) * outerR)
    } else {
      ctx.lineTo(cx + Math.cos(outerAngle) * outerR, cy + Math.sin(outerAngle) * outerR)
    }
    ctx.lineTo(cx + Math.cos(innerAngle) * innerR, cy + Math.sin(innerAngle) * innerR)
  }
  ctx.closePath()
  ctx.fill()
}
