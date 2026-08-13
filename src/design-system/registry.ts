import { createContext, useContext, useEffect, useId } from 'react'

export interface MinSizeEntry {
  expanded: number
}

export interface MinSizeRegistry {
  register: (id: string, entry: MinSizeEntry) => void
  unregister: (id: string) => void
}

const MinSizeRegistryContext = createContext<MinSizeRegistry | null>(null)

export const MinSizeRegistryProvider = MinSizeRegistryContext.Provider

export function useMinSizeRegistration(entry: MinSizeEntry | null): void {
  const registry = useContext(MinSizeRegistryContext)
  const id = useId()
  const expanded = entry?.expanded

  useEffect(() => {
    if (!registry || expanded === undefined) {
      return
    }
    registry.register(id, { expanded })
    return () => registry.unregister(id)
  }, [registry, id, expanded])
}

// A second, independent registry — deliberately not a field on MinSizeEntry.
// MinSizeEntry always sums along a Secondary's own direction (width for a
// row, height for a column, since that's the axis its children stack on).
// A column's *width* is the opposite kind of aggregate (the max across
// children, since they stretch to the widest one rather than stacking
// side by side) — a genuinely different reduction, not just a different
// number, so it gets its own registry rather than overloading MinSizeEntry
// with a field only some consumers fill in.
export interface NaturalWidthRegistry {
  register: (id: string, width: number) => void
  unregister: (id: string) => void
}

const NaturalWidthRegistryContext = createContext<NaturalWidthRegistry | null>(null)

export const NaturalWidthRegistryProvider = NaturalWidthRegistryContext.Provider

export function useNaturalWidthRegistration(width: number | null): void {
  const registry = useContext(NaturalWidthRegistryContext)
  const id = useId()

  useEffect(() => {
    if (!registry || width === null) {
      return
    }
    registry.register(id, width)
    return () => registry.unregister(id)
  }, [registry, id, width])
}

// A third registry, the same shape as NaturalWidthRegistry but for the
// other axis — needed because a row-direction root sits as a real CSS Grid
// item in a caller's layout (e.g. App.tsx's chrome grid), where an
// undersized 'auto' row track can stretch it shorter than its own content
// and clip it (the browser zeroes a scroll container's automatic minimum
// size on that axis). Fixing that needs an explicit min-height floor, and
// unlike the main axis (already summed into MinSizeEntry.expanded), a row's
// cross-axis height — the tallest child, not a sum — has nothing tracking
// it yet.
export interface NaturalHeightRegistry {
  register: (id: string, height: number) => void
  unregister: (id: string) => void
}

const NaturalHeightRegistryContext = createContext<NaturalHeightRegistry | null>(null)

export const NaturalHeightRegistryProvider = NaturalHeightRegistryContext.Provider

export function useNaturalHeightRegistration(height: number | null): void {
  const registry = useContext(NaturalHeightRegistryContext)
  const id = useId()

  useEffect(() => {
    if (!registry || height === null) {
      return
    }
    registry.register(id, height)
    return () => registry.unregister(id)
  }, [registry, id, height])
}

// A fourth registry, the same shape and reasoning as NaturalHeightRegistry
// (a column-direction root is also a real CSS Grid item, vulnerable to the
// same undersized-'auto'-track squeeze on ITS cross axis, width) — but with
// its own value rather than reusing NaturalWidthRegistry, because that
// registry always measures a child's *uncollapsed* width (the one App.tsx's
// shared isNarrow threshold needs), while the floor a collapsed column root
// needs is its children's *collapsed* (icon-only) width instead — a
// different number, not just a different reduction. Unlike the row/height
// case, there's no in-between: a row can fall back to scrolling once
// collapsed no longer fits (see the flexShrink: 0 + overflow: auto on the
// row itself), but a column's cross axis has no such fallback (overflow-x:
// hidden, not auto) — a floor is always needed here, expanded or collapsed,
// never released the way the row's minWidth is.
export interface NaturalCollapsedWidthRegistry {
  register: (id: string, width: number) => void
  unregister: (id: string) => void
}

const NaturalCollapsedWidthRegistryContext = createContext<NaturalCollapsedWidthRegistry | null>(
  null,
)

export const NaturalCollapsedWidthRegistryProvider = NaturalCollapsedWidthRegistryContext.Provider

export function useNaturalCollapsedWidthRegistration(width: number | null): void {
  const registry = useContext(NaturalCollapsedWidthRegistryContext)
  const id = useId()

  useEffect(() => {
    if (!registry || width === null) {
      return
    }
    registry.register(id, width)
    return () => registry.unregister(id)
  }, [registry, id, width])
}
