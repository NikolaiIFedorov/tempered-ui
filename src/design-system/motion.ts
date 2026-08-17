// The one easing curve every animation in this system uses — a fixed
// constant, not a DesignTokens field, because nothing here needs a *tuned*
// curve the way motionDuration needs a tuned speed (see TokensProvider.tsx).
// Shared between index.css's `.ds-interactive` (hardcoded there, CSS can't
// import this) and the imperative Web Animations API calls in Secondary.tsx,
// so both agree on the same feel.
export const MOTION_EASING = 'ease-out'

// FLIP (First-Last-Invert-Play): `el`'s box just moved from `previousRect`
// to wherever it now renders. Rather than animating the property that
// actually moved it (layout-affecting, and exactly what this design
// system's collapse-measurement system reads — see docs/design-system.md),
// this fakes the motion with a `transform`, which getBoundingClientRect()
// reflects but which never coincides with an actual registry read (those
// only re-run on React state/prop changes, not a rAF-scheduled style
// mutation outside React's render cycle). Snaps `el` back to its old visual
// position with no transition, then releases it into a transitioned glide
// to identity on the next frame — the "invert" and "play" steps.
export function playFlip(
  el: HTMLElement,
  previousRect: DOMRect,
  durationMs: number,
): void {
  const currentRect = el.getBoundingClientRect()
  const dx = previousRect.left - currentRect.left
  const dy = previousRect.top - currentRect.top
  if (dx === 0 && dy === 0) return

  el.style.transition = 'none'
  el.style.transform = `translate(${dx}px, ${dy}px)`
  // Forces the browser to apply the above before the transitioned state
  // below, rather than coalescing both into one paint and skipping the
  // animation entirely.
  el.getBoundingClientRect()
  requestAnimationFrame(() => {
    el.style.transition = `transform ${durationMs}ms ${MOTION_EASING}`
    el.style.transform = ''
  })
}
