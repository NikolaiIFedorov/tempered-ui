import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  type ColorRole,
  type OklchColor,
  resolveAccentColor,
  resolveRoleColor,
  watchDarkMode,
} from './theme'

const DEFAULT_BASE_ROLE: ColorRole = { hue: 250, chroma: 0.015, lMin: 0.05, lMax: 0.95 }
const DEFAULT_ACCENT_ROLE: ColorRole = { hue: 250, chroma: 0.15, lMin: 0.2, lMax: 0.8 }
const DEFAULT_L_STEP = 0.22

export interface ThemeContextValue {
  darkMode: boolean
  resolveBase: (layer: number) => OklchColor
  resolveAccent: (layer: number) => OklchColor
  resolveCanvas: () => OklchColor
  // The raw tunable values behind the resolvers above, plus setters — so
  // Settings can read and edit them directly rather than keeping its own
  // separate copy of the same numbers.
  baseRole: ColorRole
  setBaseRole: (role: ColorRole) => void
  accentRole: ColorRole
  setAccentRole: (role: ColorRole) => void
  lStep: number
  setLStep: (value: number) => void
}

function buildThemeValue(
  darkMode: boolean,
  baseRole: ColorRole,
  setBaseRole: (role: ColorRole) => void,
  accentRole: ColorRole,
  setAccentRole: (role: ColorRole) => void,
  lStep: number,
  setLStep: (value: number) => void,
): ThemeContextValue {
  return {
    darkMode,
    resolveBase: (layer) => resolveRoleColor(baseRole, layer, { darkMode, lStep }),
    resolveAccent: (layer) => resolveRoleColor(accentRole, layer, { darkMode, lStep }),
    // The page canvas, not a Secondary layer — the true unclamped extreme
    // (pure black/white), not resolveBase(-1). lMin/lMax exist to stop deep
    // *nesting* from washing a surface out to an extreme; the canvas isn't
    // a nested surface at risk of that, it's the one thing that's supposed
    // to reach the extreme, so clamping it defeats the point of using it as
    // the reference layer 0 steps away from.
    resolveCanvas: () => ({ l: darkMode ? 0 : 1, c: baseRole.chroma, h: baseRole.hue }),
    baseRole,
    setBaseRole,
    accentRole,
    setAccentRole,
    lStep,
    setLStep,
  }
}

// Defaults to a real, computed theme (light mode, curated accent) rather
// than requiring a provider — consistent with useLayer/useCollapsed, which
// default gracefully instead of throwing. A Secondary or Primary used
// standalone in a test or outside any ThemeProvider still renders sensibly.
// The setters are no-ops there, since there's no state to update.
const ThemeContext = createContext<ThemeContextValue>(
  buildThemeValue(
    false,
    DEFAULT_BASE_ROLE,
    () => {},
    DEFAULT_ACCENT_ROLE,
    () => {},
    DEFAULT_L_STEP,
    () => {},
  ),
)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)
  const [baseRole, setBaseRole] = useState<ColorRole>(DEFAULT_BASE_ROLE)
  const [accentRole, setAccentRole] = useState<ColorRole>(DEFAULT_ACCENT_ROLE)
  const [lStep, setLStep] = useState(DEFAULT_L_STEP)

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

  const value = useMemo(
    () =>
      buildThemeValue(darkMode, baseRole, setBaseRole, accentRole, setAccentRole, lStep, setLStep),
    [darkMode, baseRole, accentRole, lStep],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
