import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  type ColorRole,
  type OklchColor,
  resolveAccentColor,
  resolveRoleColor,
  watchDarkMode,
} from './theme'

const BASE_ROLE: ColorRole = { hue: 250, chroma: 0.015, lMin: 0.05, lMax: 0.95 }
const DEFAULT_ACCENT_ROLE: ColorRole = { hue: 250, chroma: 0.15, lMin: 0.2, lMax: 0.8 }
const L_STEP = 0.15

export interface ThemeContextValue {
  darkMode: boolean
  resolveBase: (layer: number) => OklchColor
  resolveAccent: (layer: number) => OklchColor
  resolveCanvas: () => OklchColor
}

function buildThemeValue(darkMode: boolean, accentRole: ColorRole): ThemeContextValue {
  return {
    darkMode,
    resolveBase: (layer) => resolveRoleColor(BASE_ROLE, layer, { darkMode, lStep: L_STEP }),
    resolveAccent: (layer) => resolveRoleColor(accentRole, layer, { darkMode, lStep: L_STEP }),
    // The page canvas, not a Secondary layer — the true unclamped extreme
    // (pure black/white), not resolveBase(-1). lMin/lMax exist to stop deep
    // *nesting* from washing a surface out to an extreme; the canvas isn't
    // a nested surface at risk of that, it's the one thing that's supposed
    // to reach the extreme, so clamping it defeats the point of using it as
    // the reference layer 0 steps away from.
    resolveCanvas: () => ({ l: darkMode ? 0 : 1, c: BASE_ROLE.chroma, h: BASE_ROLE.hue }),
  }
}

// Defaults to a real, computed theme (light mode, curated accent) rather
// than requiring a provider — consistent with useLayer/useCollapsed, which
// default gracefully instead of throwing. A Secondary or Primary used
// standalone in a test or outside any ThemeProvider still renders sensibly.
const ThemeContext = createContext<ThemeContextValue>(buildThemeValue(false, DEFAULT_ACCENT_ROLE))

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)
  const [accentRole, setAccentRole] = useState<ColorRole>(DEFAULT_ACCENT_ROLE)

  useEffect(() => watchDarkMode(setDarkMode), [])

  useEffect(() => {
    const accent = resolveAccentColor()
    if (accent) {
      setAccentRole({
        hue: accent.h,
        chroma: Math.max(accent.c, DEFAULT_ACCENT_ROLE.chroma),
        lMin: DEFAULT_ACCENT_ROLE.lMin,
        lMax: DEFAULT_ACCENT_ROLE.lMax,
      })
    }
  }, [])

  const value = useMemo(() => buildThemeValue(darkMode, accentRole), [darkMode, accentRole])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
