import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAccentColorSupported,
  resolveAccentColor,
  resolveRoleColor,
  watchDarkMode,
} from './theme'

describe('resolveRoleColor', () => {
  it('keeps hue and chroma fixed while lightness follows the layer equation', () => {
    const role = { hue: 250, chroma: 0.1, lMin: 0, lMax: 1 }
    const theme = { darkMode: true, lStep: 0.08 }

    const layer0 = resolveRoleColor(role, 0, theme)
    const layer1 = resolveRoleColor(role, 1, theme)

    expect(layer0).toEqual({ l: 0.08, c: 0.1, h: 250 })
    expect(layer1.l).toBeCloseTo(0.16)
    expect(layer1.c).toBe(0.1)
    expect(layer1.h).toBe(250)
  })
})

describe('isAccentColorSupported', () => {
  it('reflects what CSS.supports reports', () => {
    expect(isAccentColorSupported({ supports: () => true })).toBe(true)
    expect(isAccentColorSupported({ supports: () => false })).toBe(false)
  })
})

describe('resolveAccentColor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns undefined without touching the DOM when AccentColor isn't supported", () => {
    vi.stubGlobal('CSS', { supports: () => false })
    const doc = { createElement: vi.fn() } as unknown as Document

    expect(resolveAccentColor(doc)).toBeUndefined()
    expect(doc.createElement).not.toHaveBeenCalled()
  })

  it('converts the resolved computed color to OKLCH when supported', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const probe = document.createElement('div')
    vi.spyOn(document, 'createElement').mockReturnValue(probe)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      color: 'rgb(255, 0, 0)',
    } as CSSStyleDeclaration)

    const result = resolveAccentColor(document)

    expect(result).toBeDefined()
    expect(result!.h).toBeCloseTo(29.2, 0)
    expect(result!.l).toBeGreaterThan(0)
    expect(result!.c).toBeGreaterThan(0)
    expect(document.body.contains(probe)).toBe(false)
  })
})

describe('watchDarkMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function fakeMediaQueryList(initialMatches: boolean) {
    const listeners = new Set<(event: { matches: boolean }) => void>()
    return {
      matches: initialMatches,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
        listeners.delete(listener)
      },
      emit(matches: boolean) {
        for (const listener of listeners) listener({ matches })
      },
      listenerCount: () => listeners.size,
    }
  }

  it('reports the initial value immediately', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', {
      matchMedia: () => mql,
    })

    const onChange = vi.fn()
    watchDarkMode(onChange)

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reports subsequent OS theme changes', () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', {
      matchMedia: () => mql,
    })

    const onChange = vi.fn()
    watchDarkMode(onChange)
    mql.emit(true)

    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('stops reporting changes after the returned cleanup runs', () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', {
      matchMedia: () => mql,
    })

    const onChange = vi.fn()
    const stop = watchDarkMode(onChange)
    stop()
    mql.emit(true)

    expect(onChange).not.toHaveBeenCalledWith(true)
  })
})
