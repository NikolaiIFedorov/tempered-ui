import { describe, expect, it } from 'vitest'
import { computeDuration, computeLightness, computeSize, isAtSizeFloor } from './tokens'

describe('computeSize', () => {
  const scale = { baseSize: 16, shrinkRatio: 0.85, minSize: 4 }

  it('returns baseSize at layer 0', () => {
    expect(computeSize(0, scale)).toBe(16)
  })

  it('shrinks geometrically with layer', () => {
    expect(computeSize(1, scale)).toBeCloseTo(13.6)
    expect(computeSize(2, scale)).toBeCloseTo(11.56)
  })

  it('clamps to minSize once the geometric value drops below it', () => {
    expect(computeSize(20, scale)).toBe(4)
  })
})

describe('isAtSizeFloor', () => {
  const scale = { baseSize: 16, shrinkRatio: 0.85, minSize: 4 }

  it('is false while the geometric value is still above minSize', () => {
    expect(isAtSizeFloor(0, scale)).toBe(false)
  })

  it('is true once the geometric value would drop to or below minSize', () => {
    expect(isAtSizeFloor(20, scale)).toBe(true)
  })
})

describe('computeLightness', () => {
  const scale = { lStep: 0.08, lMin: 0, lMax: 1 }

  // Layer 0 sits two lStep's from the true extreme, not one — the canvas
  // (layer -1) reserves the first step so it never has to compete for
  // contrast in the region right next to true black/white, where OKLCH's
  // perceptual uniformity is weakest.
  it('sits two lStep from black at layer 0 in dark mode', () => {
    expect(computeLightness(0, true, scale)).toBeCloseTo(0.16)
  })

  it('sits two lStep from white at layer 0 in light mode', () => {
    expect(computeLightness(0, false, scale)).toBeCloseTo(0.84)
  })

  it('gets lighter with layer in dark mode', () => {
    expect(computeLightness(1, true, scale)).toBeCloseTo(0.24)
  })

  it('gets darker with layer in light mode', () => {
    expect(computeLightness(1, false, scale)).toBeCloseTo(0.76)
  })

  it('sits exactly one lStep from black at layer -1 (the canvas floor)', () => {
    expect(computeLightness(-1, true, scale)).toBeCloseTo(0.08)
  })

  it('sits exactly one lStep from white at layer -1 (the canvas floor)', () => {
    expect(computeLightness(-1, false, scale)).toBeCloseTo(0.92)
  })

  it('clamps to lMax in dark mode', () => {
    expect(computeLightness(50, true, scale)).toBe(1)
  })

  it('clamps to lMin in light mode', () => {
    expect(computeLightness(50, false, scale)).toBe(0)
  })
})

describe('computeDuration', () => {
  const scale = { baseDuration: 200, durationRatio: 0.9 }

  it('returns baseDuration at layer 0', () => {
    expect(computeDuration(0, scale)).toBe(200)
  })

  it('shrinks geometrically with layer', () => {
    expect(computeDuration(1, scale)).toBeCloseTo(180)
    expect(computeDuration(2, scale)).toBeCloseTo(162)
  })
})
