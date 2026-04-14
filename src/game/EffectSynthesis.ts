import type { Element, Trajectory, SynthesizedEffect } from './types'

const TRAJECTORY_PRIORITY: Record<Trajectory, number> = {
  direct: 0,
  tracking: 1,
  pierce: 2,
  area: 3,
}

const TRAJECTORY_BY_PRIORITY: Trajectory[] = ['direct', 'tracking', 'pierce', 'area']

export function synthesizeEffects(
  plants: readonly { element: Element; trajectory: Trajectory }[],
): SynthesizedEffect {
  if (plants.length === 0) {
    return { element: 'normal', trajectory: 'direct' }
  }

  let hasIce = false
  let hasFire = false
  let maxTrajectoryPriority = 0

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i]
    if (p.element === 'ice') hasIce = true
    if (p.element === 'fire') hasFire = true
    const tp = TRAJECTORY_PRIORITY[p.trajectory]
    if (tp > maxTrajectoryPriority) maxTrajectoryPriority = tp
  }

  let element: Element
  if (hasIce && hasFire) {
    element = 'normal'
  } else if (hasIce) {
    element = 'ice'
  } else if (hasFire) {
    element = 'fire'
  } else {
    element = 'normal'
  }

  return { element, trajectory: TRAJECTORY_BY_PRIORITY[maxTrajectoryPriority] }
}
