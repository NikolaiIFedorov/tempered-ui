import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  CollapseProvider,
  DirectionProvider,
  LayerProvider,
  useCollapsed,
  useOwnSecondaryLayer,
} from './layer'
import { type MinSizeEntry, MinSizeRegistryProvider, useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'

export interface SecondaryProps {
  direction?: 'row' | 'column'
  hidden?: boolean
  children: ReactNode
  style?: CSSProperties
  className?: string
}

const GAP_SCALE = { baseSize: 8, shrinkRatio: 0.85, minSize: 2 }
const PADDING_SCALE = { baseSize: 12, shrinkRatio: 0.85, minSize: 4 }

export function Secondary({
  direction = 'row',
  hidden = false,
  children,
  style,
  className,
}: SecondaryProps) {
  const layer = useOwnSecondaryLayer()
  const ancestorCollapsed = useCollapsed()
  const theme = useTheme()
  // A Secondary nested inside another Secondary is always wrapped in
  // flexShrink: 0 by its parent, so its own box can never actually be
  // squeezed by row layout — only the root (no ancestor Secondary) has a
  // box whose size reflects real external constraints, so only it runs
  // ResizeObserver-driven self-measurement. A nested Secondary purely
  // inherits its collapse state from its ancestor.
  const isRoot = layer === 0
  const containerRef = useRef<HTMLDivElement>(null)
  const entries = useRef(new Map<string, MinSizeEntry>())
  const lastAvailableSize = useRef(0)
  const hasMeasured = useRef(false)
  const [ownCollapsed, setOwnCollapsed] = useState(false)
  const [footprint, setFootprint] = useState<MinSizeEntry | null>(null)
  const collapsed = isRoot ? ownCollapsed : ancestorCollapsed

  const recompute = useCallback(
    (availableSize: number) => {
      let requiredExpanded = 0
      let requiredCollapsed = 0
      for (const entry of entries.current.values()) {
        requiredExpanded += entry.expanded
        requiredCollapsed += entry.collapsed
      }
      const gap = computeSize(layer, GAP_SCALE)
      const gapTotal = gap * Math.max(0, entries.current.size - 1)
      const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
      requiredExpanded += gapTotal + paddingTotal
      requiredCollapsed += gapTotal + paddingTotal

      setFootprint((previous) =>
        previous &&
        previous.expanded === requiredExpanded &&
        previous.collapsed === requiredCollapsed
          ? previous
          : { expanded: requiredExpanded, collapsed: requiredCollapsed },
      )

      if (isRoot && hasMeasured.current) {
        setOwnCollapsed(availableSize < requiredExpanded)
      }
    },
    [layer, isRoot],
  )

  // Reports this Secondary's own aggregate footprint to its ancestor's
  // registry (a no-op for the root, which has no ancestor registry), so
  // the ancestor's own collapse threshold accounts for nested subtrees
  // instead of being blind to them.
  useMinSizeRegistration(footprint)

  const registry = useMemo(
    () => ({
      register(id: string, entry: MinSizeEntry) {
        entries.current.set(id, entry)
        recompute(lastAvailableSize.current)
      },
      unregister(id: string) {
        entries.current.delete(id)
        recompute(lastAvailableSize.current)
      },
    }),
    [recompute],
  )

  useEffect(() => {
    if (!isRoot) return
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
  }, [direction, recompute, isRoot])

  if (hidden) return null

  const background = theme.resolveBase(layer)
  const ink = computeInkColor(background)

  const flexRow = (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        // Hugs its content's width instead of filling its parent (matching
        // what a toolbar should look like), but still clamps down to the
        // parent's real available space when that's smaller.
        width: 'fit-content',
        maxWidth: '100%',
        gap: computeSize(layer, GAP_SCALE),
        padding: computeSize(layer, PADDING_SCALE),
        backgroundColor: toCssColor(background),
        color: toCssColor(ink),
        overflowX: direction === 'row' ? 'auto' : 'hidden',
        overflowY: direction === 'row' ? 'hidden' : 'auto',
        ...style,
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
  )

  return (
    <LayerProvider value={layer}>
      <CollapseProvider value={collapsed}>
        <DirectionProvider value={direction}>
          <MinSizeRegistryProvider value={registry}>
            {isRoot ? (
              // The measured box must always reflect the true available
              // space, never its own content — fit-content on it directly
              // would make it hug whatever's currently rendered (including
              // the collapsed version), making ResizeObserver read its own
              // collapse decision back as "not enough room" and get stuck.
              // This invisible width: 100% wrapper is what's measured; the
              // fit-content, visually-styled row lives inside it, unmeasured.
              <div ref={containerRef} style={{ width: '100%' }}>
                {flexRow}
              </div>
            ) : (
              flexRow
            )}
          </MinSizeRegistryProvider>
        </DirectionProvider>
      </CollapseProvider>
    </LayerProvider>
  )
}
