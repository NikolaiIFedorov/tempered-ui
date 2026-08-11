import { createContext, useContext } from 'react'

const LayerContext = createContext<number | null>(null)

export function useLayer(): number {
  return useContext(LayerContext) ?? 0
}

export function useOwnSecondaryLayer(): number {
  const parentLayer = useContext(LayerContext)
  return parentLayer === null ? 0 : parentLayer + 1
}

export const LayerProvider = LayerContext.Provider

const CollapseContext = createContext(false)

export function useCollapsed(): boolean {
  return useContext(CollapseContext)
}

export const CollapseProvider = CollapseContext.Provider

const DirectionContext = createContext<'row' | 'column'>('row')

// The layout axis of the nearest enclosing Secondary — a registering
// Primary needs this to know whether it should measure/report its own
// width or height, since a Secondary compares available space along
// whichever axis it actually lays its children out on.
export function useSecondaryDirection(): 'row' | 'column' {
  return useContext(DirectionContext)
}

export const DirectionProvider = DirectionContext.Provider
