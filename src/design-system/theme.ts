import { converter, wcagContrast } from 'culori'
import { computeLightness } from './tokens'

export interface OklchColor {
  l: number
  c: number
  h: number
}

export interface ColorRole {
  hue: number
  chroma: number
  lMin: number
  lMax: number
}

export function resolveRoleColor(
  role: ColorRole,
  layer: number,
  theme: { darkMode: boolean; lStep: number },
): OklchColor {
  const l = computeLightness(layer, theme.darkMode, {
    lStep: theme.lStep,
    lMin: role.lMin,
    lMax: role.lMax,
  })
  return { l, c: role.chroma, h: role.hue }
}

const WHITE: OklchColor = { l: 1, c: 0, h: 0 }
const BLACK: OklchColor = { l: 0, c: 0, h: 0 }

// Picks whichever of pure black/white clears the WCAG 2.x relative-luminance
// contrast ratio (AA normal text = 4.5:1) more strongly against the given
// background. culori's wcagContrast implements the real ratio — an OKLCH
// lightness delta alone isn't an equivalent stand-in for it.
export function computeInkColor(background: OklchColor): OklchColor {
  const bg = { mode: 'oklch' as const, ...background }
  const contrastWithWhite = wcagContrast(bg, { mode: 'oklch', ...WHITE })
  const contrastWithBlack = wcagContrast(bg, { mode: 'oklch', ...BLACK })
  return contrastWithWhite >= contrastWithBlack ? WHITE : BLACK
}

export function toCssColor(color: OklchColor): string {
  return `oklch(${color.l} ${color.c} ${color.h})`
}

const toOklch = converter('oklch')

export function isAccentColorSupported(cssApi: Pick<typeof CSS, 'supports'> = CSS): boolean {
  return cssApi.supports('color', 'AccentColor')
}

export function resolveAccentColor(doc: Document = document): OklchColor | undefined {
  if (typeof CSS === 'undefined' || !isAccentColorSupported()) {
    return undefined
  }

  const probe = doc.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.color = 'AccentColor'
  doc.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  doc.body.removeChild(probe)

  const oklch = toOklch(resolved)
  if (!oklch) return undefined
  return { l: oklch.l, c: oklch.c ?? 0, h: oklch.h ?? 0 }
}

export function watchDarkMode(onChange: (darkMode: boolean) => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent) => onChange(event.matches)
  query.addEventListener('change', listener)
  onChange(query.matches)
  return () => query.removeEventListener('change', listener)
}
