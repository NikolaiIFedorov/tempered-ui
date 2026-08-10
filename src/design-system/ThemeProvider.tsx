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
const L_STEP = 0.08

export interface ThemeContextValue {
  darkMode: boolean
  resolveBase: (layer: number) => OklchColor
  resolveAccent: (layer: number) => OklchColor
}

function buildThemeValue(darkMode: boolean, accentRole: ColorRole): ThemeContextValue {
  return {
    darkMode,
    resolveBase: (layer) => resolveRoleColor(BASE_ROLE, layer, { darkMode, lStep: L_STEP }),
    resolveAccent: (layer) => resolveRoleColor(accentRole, layer, { darkMode, lStep: L_STEP }),
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
