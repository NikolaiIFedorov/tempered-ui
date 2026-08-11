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
  // Reordering is a controlled operation, the same way a controlled
  // <input> reports changes instead of owning its own value: Secondary
  // handles the drag gesture and live visual feedback, but the actual
  // list order lives wherever the caller's data already lives. Omit to
  // leave children un-draggable.
  onReorder?: (newOrder: string[]) => void
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
  onReorder,
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

  // Reordering: dragOrder is the live preview order while actively
  // dragging (null the rest of the time, meaning "render children in
  // their natural prop order"). itemRefs lets the drag handler measure
  // every sibling's current position to figure out where the dragged item
  // should land.
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const reorderStateRef = useRef<{ key: string; order: string[] } | null>(null)

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

  const handleItemPointerDown = useCallback(
    (key: string, naturalOrder: string[]) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!onReorder) return
      event.currentTarget.setPointerCapture(event.pointerId)
      reorderStateRef.current = { key, order: naturalOrder }
      setDragOrder(naturalOrder)
    },
    [onReorder],
  )

  const handleItemPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = reorderStateRef.current
      if (!state) return
      const pointerPos = direction === 'row' ? event.clientX : event.clientY
      const order = [...state.order]
      const draggedIndex = order.indexOf(state.key)
      let targetIndex = draggedIndex

      order.forEach((key, index) => {
        if (key === state.key) return
        const el = itemRefs.current.get(key)
        if (!el) return
        const rect = el.getBoundingClientRect()
        const mid =
          direction === 'row' ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2
        if (pointerPos > mid && index > targetIndex) targetIndex = index
        if (pointerPos < mid && index < targetIndex) targetIndex = index
      })

      if (targetIndex !== draggedIndex) {
        order.splice(draggedIndex, 1)
        order.splice(targetIndex, 0, state.key)
        reorderStateRef.current = { key: state.key, order }
        setDragOrder(order)
      }
    },
    [direction],
  )

  const handleItemPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = reorderStateRef.current
      reorderStateRef.current = null
      setDragOrder(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (state) onReorder?.(state.order)
    },
    [onReorder],
  )

  if (hidden) return null

  const background = theme.resolveBase(layer)
  const ink = computeInkColor(background)
  const padding = computeSize(layer, PADDING_SCALE)

  const keyedChildren = new Map<string, ReactNode>()
  const naturalOrder: string[] = []
  Children.forEach(children, (child, index) => {
    const key = isValidElement(child) && child.key !== null ? String(child.key) : String(index)
    keyedChildren.set(key, child)
    naturalOrder.push(key)
  })
  const renderOrder = dragOrder ?? naturalOrder

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
      {renderOrder.map((key) => (
        <div
          key={key}
          data-key={key}
          ref={(el) => {
            if (el) itemRefs.current.set(key, el)
            else itemRefs.current.delete(key)
          }}
          onPointerDown={onReorder ? handleItemPointerDown(key, naturalOrder) : undefined}
          onPointerMove={onReorder ? handleItemPointerMove : undefined}
          onPointerUp={onReorder ? handleItemPointerUp : undefined}
          style={{
            flexShrink: 0,
            cursor: onReorder ? 'grab' : undefined,
            opacity: reorderStateRef.current?.key === key ? 0.5 : 1,
            touchAction: onReorder ? 'none' : undefined,
          }}
        >
          {keyedChildren.get(key)}
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
