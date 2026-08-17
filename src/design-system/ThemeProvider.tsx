import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  type ColorRole,
  type OklchColor,
  resolveAccentColor,
  resolveRoleColor,
  watchDarkMode,
} from './theme'
import { computeLightness } from './tokens'

const DEFAULT_ACCENT_ROLE: ColorRole = { hue: 250, chroma: 0.15 }
const DEFAULT_CONTRAST = 0.1

// Base's hue always tracks Accent's hue (see buildThemeValue) rather than
// being independently settable — a whisper-strength tint that follows
// whatever Accent currently is stays harmonious by construction, instead
// of clashing the moment Accent moves away from a hardcoded value. This
// chroma is what keeps that tint "boring" regardless of how saturated
// Accent gets.
const BASE_CHROMA = 0.015

export type ThemeMode = 'dark' | 'light' | 'auto'

function resolveDarkMode(themeMode: ThemeMode, osDarkMode: boolean): boolean {
  if (themeMode === 'auto') return osDarkMode
  return themeMode === 'dark'
}

export interface ThemeContextValue {
  darkMode: boolean
  resolveBase: (layer: number) => OklchColor
  resolveAccent: (layer: number) => OklchColor
  resolveCanvas: () => OklchColor
  // Derived from accentRole, not independently settable — see BASE_CHROMA.
  baseRole: ColorRole
  // The raw tunable values behind the resolvers above, plus setters — so
  // Settings can read and edit them directly rather than keeping its own
  // separate copy of the same numbers.
  accentRole: ColorRole
  setAccentRole: (role: ColorRole) => void
  contrast: number
  setContrast: (value: number) => void
  // 'auto' follows the OS's prefers-color-scheme (darkMode above tracks it
  // live); 'dark'/'light' pin darkMode regardless of what the OS reports.
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

function buildThemeValue(
  darkMode: boolean,
  accentRole: ColorRole,
  setAccentRole: (role: ColorRole) => void,
  contrast: number,
  setContrast: (value: number) => void,
  themeMode: ThemeMode,
  setThemeMode: (mode: ThemeMode) => void,
): ThemeContextValue {
  const baseRole: ColorRole = { hue: accentRole.hue, chroma: BASE_CHROMA }

  return {
    darkMode,
    resolveBase: (layer) => resolveRoleColor(baseRole, layer, { darkMode, contrast }),
    resolveAccent: (layer) => resolveRoleColor(accentRole, layer, { darkMode, contrast }),
    // The page canvas, not a Secondary layer — layer -1 in the same
    // lightness equation every other layer uses. It falls out of that
    // equation rather than being clamped to it: geometric stepping already
    // keeps it short of true black/white, so a screen showing nothing stays
    // visually distinct from a canvas that's merely dark.
    resolveCanvas: () => ({
      l: computeLightness(-1, darkMode, { contrast }),
      c: baseRole.chroma,
      h: baseRole.hue,
    }),
    baseRole,
    accentRole,
    setAccentRole,
    contrast,
    setContrast,
    themeMode,
    setThemeMode,
  }
}

// Defaults to a real, computed theme (light mode, curated accent) rather
// than requiring a provider — consistent with useLayer/useCollapsed, which
// default gracefully instead of throwing. A Secondary or Primary used
// standalone in a test or outside any ThemeProvider still renders sensibly.
// The setters are no-ops there, since there's no state to update.
const ThemeContext = createContext<ThemeContextValue>(
  buildThemeValue(false, DEFAULT_ACCENT_ROLE, () => {}, DEFAULT_CONTRAST, () => {}, 'auto', () => {}),
)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [osDarkMode, setOsDarkMode] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')
  const [accentRole, setAccentRole] = useState<ColorRole>(DEFAULT_ACCENT_ROLE)
  const [contrast, setContrast] = useState(DEFAULT_CONTRAST)

  useEffect(() => watchDarkMode(setOsDarkMode), [])

  useEffect(() => {
    const accent = resolveAccentColor()
    if (accent) {
      setAccentRole({
        hue: accent.h,
        chroma: Math.max(accent.c, DEFAULT_ACCENT_ROLE.chroma),
      })
    }
  }, [])

  const darkMode = resolveDarkMode(themeMode, osDarkMode)

  const value = useMemo(
    () => buildThemeValue(darkMode, accentRole, setAccentRole, contrast, setContrast, themeMode, setThemeMode),
    [darkMode, accentRole, contrast, themeMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
