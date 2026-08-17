export interface ColorScale {
  // Fraction of the remaining distance to the far extreme (white in dark
  // mode, black in light mode) that's consumed by each layer step. Higher
  // contrast means a bigger jump per layer; the fraction retained for the
  // next layer is (1 - contrast).
  contrast: number
}

// Geometric, not additive: distance to the far extreme shrinks by
// (1 - contrast) each layer, so L asymptotically approaches but never
// reaches 0 or 1 — unlike a linear step, no explicit lMin/lMax clamp is
// needed to keep arbitrarily deep nesting inside the valid range. Layer -1
// (the canvas) falls out of the same formula instead of being a special
// case: it's short of true black/white by one step rather than sitting at
// the true extreme, so a canvas stays visually distinct from a screen
// showing nothing at all.
export function computeLightness(layer: number, darkMode: boolean, scale: ColorScale): number {
  const remaining = (1 - scale.contrast) ** (layer + 2)
  return darkMode ? 1 - remaining : remaining
}
