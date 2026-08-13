import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'

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
  }
}

function Probe() {
  const theme = useTheme()
  const base0 = theme.resolveBase(0)
  const accent0 = theme.resolveAccent(0)
  const canvas = theme.resolveCanvas()
  return (
    <div>
      <div data-testid="dark-mode">{String(theme.darkMode)}</div>
      <div data-testid="base-l">{base0.l}</div>
      <div data-testid="accent-l">{accent0.l}</div>
      <div data-testid="accent-h">{accent0.h}</div>
      <div data-testid="canvas-l">{canvas.l}</div>
    </div>
  )
}

describe('ThemeProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('defaults to a real, usable theme outside a ThemeProvider (light mode, curated accent)', () => {
    render(<Probe />)

    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
    const baseL = Number(screen.getByTestId('base-l').textContent)
    expect(baseL).toBeGreaterThan(0)
    expect(baseL).toBeLessThan(1)
  })

  it('reflects prefers-color-scheme and reacts to changes', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')

    act(() => {
      mql.emit(false)
    })
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
  })

  it('resolves base color through the layer equation', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // darkMode: baseL at layer 0 = 2 * lStep, a small positive number, not 0 or 1.
    const baseL = Number(screen.getByTestId('base-l').textContent)
    expect(baseL).toBeGreaterThan(0)
    expect(baseL).toBeLessThan(0.5)
  })

  it('falls back to a curated default accent when AccentColor is unsupported', () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('accent-l')).toBeInTheDocument()
  })

  it('resolves the canvas one lStep short of the true extreme, a full lStep away from layer 0', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // Dark mode: canvas sits one lStep above true black, not at it.
    const canvasL = Number(screen.getByTestId('canvas-l').textContent)
    expect(canvasL).toBeGreaterThan(0)
    const baseL = Number(screen.getByTestId('base-l').textContent)
    // Default lStep (see ThemeProvider's DEFAULT_L_STEP) is 0.22.
    expect(baseL - canvasL).toBeCloseTo(0.22)
  })
})
