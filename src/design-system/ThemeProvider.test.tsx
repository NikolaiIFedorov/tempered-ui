import { act, fireEvent, render, screen } from '@testing-library/react'
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
      <div data-testid="theme-mode">{theme.themeMode}</div>
      <div data-testid="base-l">{base0.l}</div>
      <div data-testid="base-h">{base0.h}</div>
      <div data-testid="base-c">{base0.c}</div>
      <div data-testid="accent-l">{accent0.l}</div>
      <div data-testid="accent-h">{accent0.h}</div>
      <div data-testid="canvas-l">{canvas.l}</div>
      <button onClick={() => theme.setThemeMode('dark')}>force dark</button>
      <button onClick={() => theme.setThemeMode('light')}>force light</button>
      <button onClick={() => theme.setThemeMode('auto')}>use auto</button>
      <button onClick={() => theme.setAccentRole({ hue: 40, chroma: 0.2 })}>
        set custom accent
      </button>
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

  it('defaults to auto mode and reflects prefers-color-scheme, reacting to changes', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-mode')).toHaveTextContent('auto')
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')

    act(() => {
      mql.emit(false)
    })
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
  })

  it('forcing dark mode ignores the OS preference', () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
    fireEvent.click(screen.getByText('force dark'))
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')

    // Stays forced even as the OS preference keeps changing underneath it.
    act(() => {
      mql.emit(false)
    })
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')
  })

  it('forcing light mode ignores the OS preference', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')
    fireEvent.click(screen.getByText('force light'))
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
  })

  it('switching back to auto resumes following the OS preference', () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByText('force dark'))
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')

    fireEvent.click(screen.getByText('use auto'))
    expect(screen.getByTestId('theme-mode')).toHaveTextContent('auto')
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

    // darkMode: baseL at layer 0 is 1 - (1 - contrast)^2, a small positive number, not 0 or 1.
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

  it("derives Base's hue from Accent's hue rather than exposing it independently", () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // Default fallback accent's hue.
    expect(screen.getByTestId('base-h')).toHaveTextContent('250')
    expect(screen.getByTestId('accent-h')).toHaveTextContent('250')

    fireEvent.click(screen.getByText('set custom accent'))

    // Base's hue tracks the new accent hue automatically.
    expect(screen.getByTestId('accent-h')).toHaveTextContent('40')
    expect(screen.getByTestId('base-h')).toHaveTextContent('40')
  })

  it("keeps Base's chroma pinned low regardless of Accent's chroma", () => {
    const mql = fakeMediaQueryList(false)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByText('set custom accent'))

    // Accent's chroma (0.2, set above) is much higher than Base's, which
    // stays fixed so Base reads as "boring" no matter what Accent is doing.
    const baseC = Number(screen.getByTestId('base-c').textContent)
    expect(baseC).toBeGreaterThan(0)
    expect(baseC).toBeLessThan(0.05)
  })

  it('resolves the canvas closer to true black than layer 0, never at it', () => {
    const mql = fakeMediaQueryList(true)
    vi.stubGlobal('window', { matchMedia: () => mql })
    vi.stubGlobal('CSS', { supports: () => false })

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    // Dark mode: canvas sits strictly above true black, and strictly below layer 0.
    const canvasL = Number(screen.getByTestId('canvas-l').textContent)
    const baseL = Number(screen.getByTestId('base-l').textContent)
    expect(canvasL).toBeGreaterThan(0)
    expect(canvasL).toBeLessThan(baseL)
  })
})
