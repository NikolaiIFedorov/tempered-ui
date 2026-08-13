export interface SizeScale {
  baseSize: number
  shrinkRatio: number
  minSize: number
}

export function computeSize(layer: number, scale: SizeScale): number {
  return Math.max(scale.minSize, scale.baseSize * scale.shrinkRatio ** layer)
}

export function isAtSizeFloor(layer: number, scale: SizeScale): boolean {
  return scale.baseSize * scale.shrinkRatio ** layer <= scale.minSize
}

export interface ColorScale {
  lStep: number
  lMin: number
  lMax: number
}

// baseL (layer -1) is the canvas floor: one lStep from the true extreme,
// not the extreme itself. Reserving that first step for the canvas keeps
// every rendered layer's contrast step in the region where OKLCH's
// perceptual uniformity actually holds, away from the compression near
// true black/white where an equal lStep reads as a smaller visual jump.
export function computeLightness(layer: number, darkMode: boolean, scale: ColorScale): number {
  const baseL = darkMode ? scale.lStep : 1 - scale.lStep
  const sign = darkMode ? 1 : -1
  const l = baseL + sign * (layer + 1) * scale.lStep
  return Math.min(scale.lMax, Math.max(scale.lMin, l))
}

export interface DurationScale {
  baseDuration: number
  durationRatio: number
}

export function computeDuration(layer: number, scale: DurationScale): number {
  return scale.baseDuration * scale.durationRatio ** layer
}
