import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { requiredChromeWidth } from './App'

describe('requiredChromeWidth', () => {
  it('is the second row (settings + tools + misc, plus their gaps) when that row is the tightest', () => {
    const width = requiredChromeWidth({ files: 10, settings: 50, tools: 50, misc: 50 })
    // second row: 50 + 50 + 50 + gap*2 (24) = 174; files row: 10.
    // max(174, 10) + chrome padding*2 (24) = 198.
    expect(width).toBe(198)
  })

  it('is the files row instead, when files alone needs more room than the second row combined', () => {
    const width = requiredChromeWidth({ files: 1000, settings: 10, tools: 10, misc: 10 })
    // second row: 10 + 10 + 10 + 24 = 54; files: 1000.
    // max(1000, 54) + 24 = 1024.
    expect(width).toBe(1024)
  })
})

// Every layer below App (Button/Input's natural-width probes, Secondary's
// aggregation) already has its own focused unit tests — this exercises the
// wiring that connects them: real chrome content drives barWidths, which
// drives requiredChromeWidth, which drives isNarrow, which drives every
// bar's forceCollapsed together. Only directional behavior is asserted
// (comfortably above the requirement vs. absurdly below it), not an exact
// pixel threshold, since the real SettingsPanel's true natural width isn't
// hand-computed here.
describe('AppContent responsiveness to window width', () => {
  const ignoreProbe = { ignore: '[aria-hidden="true"] *' }

  beforeEach(() => {
    // Every real button/input's off-viewport probe reports the same modest
    // natural size, so the chrome has a genuine, non-zero width requirement
    // to compare the window against; anything not a probe measures 0,
    // matching jsdom's real default for elements with no layout engine.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.getAttribute('aria-hidden') === 'true' ? 60 : 0
      return { width } as DOMRect
    })
    // jsdom has no real implementation — ThemeProvider's dark-mode watcher
    // needs at least this much to mount at all, unrelated to what this
    // suite is actually exercising.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('CSS', { supports: () => false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  }

  it('shows full labels once the window is comfortably wider than the chrome needs', () => {
    setWindowWidth(3000)
    render(<App />)

    expect(screen.getByText('New', ignoreProbe)).toBeInTheDocument()
  })

  it('collapses every bar to icons together once the window narrows below what the chrome needs', () => {
    setWindowWidth(3000)
    render(<App />)
    expect(screen.getByText('New', ignoreProbe)).toBeInTheDocument()

    setWindowWidth(50)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.queryByText('New', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })

  it('expands again once the window widens back past the requirement', () => {
    setWindowWidth(50)
    render(<App />)
    expect(screen.queryByText('New', ignoreProbe)).not.toBeInTheDocument()

    setWindowWidth(3000)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByText('New', ignoreProbe)).toBeInTheDocument()
  })
})
