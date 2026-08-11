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
