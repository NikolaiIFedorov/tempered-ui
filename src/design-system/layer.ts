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
