import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CollapseProvider, LayerProvider, useCollapsed, useOwnSecondaryLayer } from './layer'
import { type MinSizeEntry, MinSizeRegistryProvider } from './registry'
import { computeSize } from './tokens'

export interface SecondaryProps {
  direction?: 'row' | 'column'
  hidden?: boolean
  children: ReactNode
}

const GAP_SCALE = { baseSize: 8, shrinkRatio: 0.85, minSize: 2 }

export function Secondary({ direction = 'row', hidden = false, children }: SecondaryProps) {
  const layer = useOwnSecondaryLayer()
  const ancestorCollapsed = useCollapsed()
  const containerRef = useRef<HTMLDivElement>(null)
  const entries = useRef(new Map<string, MinSizeEntry>())
  const lastAvailableSize = useRef(0)
  const hasMeasured = useRef(false)
  const [ownCollapsed, setOwnCollapsed] = useState(false)
  const collapsed = ancestorCollapsed || ownCollapsed

  const recompute = useCallback(
    (availableSize: number) => {
      let required = 0
      for (const entry of entries.current.values()) {
        required += entry.expanded
      }
      const gap = computeSize(layer, GAP_SCALE)
      required += gap * Math.max(0, entries.current.size - 1)
      setOwnCollapsed(availableSize < required)
    },
    [layer],
  )

  const registry = useMemo(
    () => ({
      register(id: string, entry: MinSizeEntry) {
        entries.current.set(id, entry)
        if (hasMeasured.current) recompute(lastAvailableSize.current)
      },
      unregister(id: string) {
        entries.current.delete(id)
        if (hasMeasured.current) recompute(lastAvailableSize.current)
      },
    }),
    [recompute],
  )

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver((observedEntries) => {
      const [entry] = observedEntries
      if (!entry) return
      const size = direction === 'row' ? entry.contentRect.width : entry.contentRect.height
      lastAvailableSize.current = size
      hasMeasured.current = true
      recompute(size)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [direction, recompute])

  if (hidden) return null

  return (
    <LayerProvider value={layer}>
      <CollapseProvider value={collapsed}>
        <MinSizeRegistryProvider value={registry}>
          <div
            ref={containerRef}
            style={{
              display: 'flex',
              flexDirection: direction,
              gap: computeSize(layer, GAP_SCALE),
              overflowX: direction === 'row' ? 'auto' : 'hidden',
              overflowY: direction === 'row' ? 'hidden' : 'auto',
            }}
          >
            {Children.map(children, (child, index) => (
              <div
                key={isValidElement(child) && child.key !== null ? child.key : index}
                style={{ flexShrink: 0 }}
              >
                {child}
              </div>
            ))}
          </div>
        </MinSizeRegistryProvider>
      </CollapseProvider>
    </LayerProvider>
  )
}
