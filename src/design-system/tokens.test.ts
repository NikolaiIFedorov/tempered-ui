import { describe, expect, it } from 'vitest'
import { computeLightness } from './tokens'

describe('computeLightness', () => {
  const scale = { contrast: 0.2 }

  // Geometric, not additive: the remaining distance to the far extreme
  // shrinks by (1 - contrast) each layer, so L can never overshoot [0,1]
  // no matter how deep the nesting goes — no lMin/lMax clamp needed.
  it('sits (1 - contrast) away from black at layer -1 (the canvas floor) in dark mode', () => {
    expect(computeLightness(-1, true, scale)).toBeCloseTo(0.2)
  })

  it('sits (1 - contrast) away from white at layer -1 (the canvas floor) in light mode', () => {
    expect(computeLightness(-1, false, scale)).toBeCloseTo(0.8)
  })

  it('gets lighter with layer in dark mode', () => {
    expect(computeLightness(0, true, scale)).toBeCloseTo(0.36)
    expect(computeLightness(1, true, scale)).toBeCloseTo(0.488)
  })

  it('gets darker with layer in light mode', () => {
    expect(computeLightness(0, false, scale)).toBeCloseTo(0.64)
    expect(computeLightness(1, false, scale)).toBeCloseTo(0.512)
  })

  it('approaches but never reaches white at arbitrary nesting depth in dark mode', () => {
    const l = computeLightness(50, true, scale)
    expect(l).toBeLessThan(1)
    expect(l).toBeGreaterThan(0.999)
  })

  it('approaches but never reaches black at arbitrary nesting depth in light mode', () => {
    const l = computeLightness(50, false, scale)
    expect(l).toBeGreaterThan(0)
    expect(l).toBeLessThan(0.001)
  })
})
