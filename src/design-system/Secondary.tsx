import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
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
  resizable?: boolean
  children: ReactNode
  style?: CSSProperties
  className?: string
}

const GAP_SCALE = { baseSize: 8, shrinkRatio: 0.85, minSize: 2 }
const PADDING_SCALE = { baseSize: 12, shrinkRatio: 0.6, minSize: 4 }
// Fillets (border-radius) aren't a token of their own — they're derived
// straight from padding, scaling proportionally with it for free.
const RADIUS_RATIO = 0.5
const HANDLE_WIDTH = 6

export function Secondary({
  direction = 'row',
  hidden = false,
  resizable = false,
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
  // Even for the root, self-measurement only makes sense for direction:
  // "row" — a block element always gets a genuine width from its
  // containing block in ordinary page flow, but its height is intrinsic
  // (auto) unless something explicitly constrains it. A column Secondary's
  // measurement wrapper would just hug its own content's height, making
  // "available vs. required" self-referential — any one bad reading during
  // a fast resize can permanently stick it collapsed, the same failure
  // mode nested Secondaries hit before they stopped self-measuring.
  const selfMeasures = isRoot && direction === 'row'
  const containerRef = useRef<HTMLDivElement>(null)
  const entries = useRef(new Map<string, MinSizeEntry>())
  const lastAvailableSize = useRef(0)
  const hasMeasured = useRef(false)
  const [ownCollapsed, setOwnCollapsed] = useState(false)
  const [footprint, setFootprint] = useState<MinSizeEntry | null>(null)
  const collapsed = selfMeasures ? ownCollapsed : ancestorCollapsed
  // The user-dragged width override, if any — reusing the exact same
  // measurement pipeline a real viewport resize goes through: this becomes
  // the measurement wrapper's explicit width, so the same ResizeObserver
  // and recompute() that already handle viewport shrinkage handle a drag
  // shrink too. null means "no override, size naturally."
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const requiredRef = useRef({ expanded: 0, collapsed: 0 })
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const recompute = useCallback(
    (availableSize: number) => {
      let requiredExpanded = 0
      let requiredCollapsed = 0
      for (const entry of entries.current.values()) {
        requiredExpanded += entry.expanded
        requiredCollapsed += entry.collapsed
      }
      const showsHandle = resizable && selfMeasures
      const itemCount = entries.current.size + (showsHandle ? 1 : 0)
      const gap = computeSize(layer, GAP_SCALE)
      const gapTotal = gap * Math.max(0, itemCount - 1)
      const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
      const handleTotal = showsHandle ? HANDLE_WIDTH : 0
      requiredExpanded += gapTotal + paddingTotal + handleTotal
      requiredCollapsed += gapTotal + paddingTotal + handleTotal

      setFootprint((previous) =>
        previous &&
        previous.expanded === requiredExpanded &&
        previous.collapsed === requiredCollapsed
          ? previous
          : { expanded: requiredExpanded, collapsed: requiredCollapsed },
      )

      requiredRef.current = { expanded: requiredExpanded, collapsed: requiredCollapsed }
      // If children changed and the current drag width now falls below the
      // new floor (e.g. a child was removed and requiredCollapsed grew),
      // re-clamp rather than leave a stale, out-of-range width in place.
      // No upper re-clamp: dragging wider than natural content is fine —
      // the wrapper's own maxWidth: 100% is the real ceiling (true
      // available space), not requiredExpanded. Capping at exactly
      // requiredExpanded created a knife's-edge value: the JS-computed
      // clamp and what the real browser reports back through
      // ResizeObserver after layout don't perfectly agree (subpixel
      // rounding), so a drag aimed at "fully expanded" would land just
      // under the threshold and stay collapsed no matter how far dragged.
      setDragWidth((previous) =>
        previous === null ? previous : Math.max(requiredCollapsed, previous),
      )

      if (selfMeasures && hasMeasured.current) {
        setOwnCollapsed(availableSize < requiredExpanded)
      }
    },
    [layer, selfMeasures, resizable],
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
    if (!selfMeasures) return
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver((observedEntries) => {
      const [entry] = observedEntries
      if (!entry) return
      lastAvailableSize.current = entry.contentRect.width
      hasMeasured.current = true
      recompute(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [recompute, selfMeasures])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: containerRef.current.getBoundingClientRect().width,
    }
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return
    const raw = dragStateRef.current.startWidth + (event.clientX - dragStateRef.current.startX)
    setDragWidth(Math.max(requiredRef.current.collapsed, raw))
  }, [])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (hidden) return null

  const background = theme.resolveBase(layer)
  const ink = computeInkColor(background)
  const padding = computeSize(layer, PADDING_SCALE)

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
        padding,
        borderRadius: padding * RADIUS_RATIO,
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
      {resizable && selfMeasures ? (
        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            flexShrink: 0,
            alignSelf: 'stretch',
            width: 6,
            cursor: 'col-resize',
            touchAction: 'none',
          }}
        />
      ) : null}
    </div>
  )

  return (
    <LayerProvider value={layer}>
      <CollapseProvider value={collapsed}>
        <DirectionProvider value={direction}>
          <MinSizeRegistryProvider value={registry}>
            {selfMeasures ? (
              // The measured box must always reflect the true available
              // space, never its own content — fit-content on it directly
              // would make it hug whatever's currently rendered (including
              // the collapsed version), making ResizeObserver read its own
              // collapse decision back as "not enough room" and get stuck.
              // This invisible width: 100% wrapper is what's measured; the
              // fit-content, visually-styled row lives inside it, unmeasured.
              // A drag sets an explicit width instead of 100% — maxWidth
              // still applies, so a real viewport shrink below the dragged
              // width still wins and gets measured correctly.
              <div ref={containerRef} style={{ width: dragWidth ?? '100%', maxWidth: '100%' }}>
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
