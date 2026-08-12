import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  CollapseProvider,
  DirectionProvider,
  LayerProvider,
  useCollapsed,
  useOwnSecondaryLayer,
  useSecondaryDirection,
} from './layer'
import { type MinSizeEntry, MinSizeRegistryProvider, useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'
import { useTokens } from './TokensProvider'

export interface SecondaryProps {
  direction?: 'row' | 'column'
  hidden?: boolean
  // An explicit override, ORed into the collapse decision this Secondary
  // would otherwise reach on its own (self-measurement for a row root,
  // ancestor cascade otherwise). Exists because several independent root
  // Secondaries can't coordinate a shared "not enough room overall"
  // decision purely from each one's own measurement — a column-direction
  // root in particular never self-measures at all (see below), so without
  // this it has no way to collapse in response to anything. A caller that
  // wants a set of independent bars to collapse together computes that
  // signal itself and passes it to each of them.
  forceCollapsed?: boolean
  // A row-direction root normally self-measures independently (see
  // `selfMeasures` below) — fine on its own, but when a caller is already
  // driving a set of roots off one shared `forceCollapsed` signal, letting
  // a row root *also* keep its own independent ResizeObserver reading
  // means it can flip collapsed at a different width than its siblings
  // (e.g. one sitting in a flexible grid track that narrows faster than
  // the window itself), producing a staggered, non-uniform collapse even
  // though every root received the same forceCollapsed value. Set false to
  // disable a row root's own measurement and rely purely on forceCollapsed,
  // the same way a column root (which never self-measures at all) already
  // does.
  selfMeasure?: boolean
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

export function Secondary({
  direction = 'row',
  hidden = false,
  forceCollapsed = false,
  selfMeasure = true,
  onReorder,
  children,
  style,
  className,
}: SecondaryProps) {
  const layer = useOwnSecondaryLayer()
  const ancestorCollapsed = useCollapsed()
  // Read *before* this Secondary provides its own DirectionProvider below
  // — this is the direction its own enclosing Secondary declared for its
  // children (row default at the root), the same ambient value Button and
  // Input read to know whether to stretch.
  const parentDirection = useSecondaryDirection()
  const theme = useTheme()
  const {
    secondaryGap: GAP_SCALE,
    secondaryPadding: PADDING_SCALE,
    secondaryRadiusRatio: RADIUS_RATIO,
  } = useTokens()
  // A Secondary nested inside another Secondary is always wrapped in
  // flexShrink: 0 by its parent, so its own box can never actually be
  // squeezed by row layout — only the root (no ancestor Secondary) has a
  // box whose size reflects real external constraints, so only it runs
  // ResizeObserver-driven self-measurement. A nested Secondary purely
  // inherits its collapse state from its ancestor.
  const isRoot = layer === 0
  // Even for the root, viewport self-measurement only makes sense for
  // direction: "row" — a block element always gets a genuine width from
  // its containing block in ordinary page flow, but its height is
  // intrinsic (auto) unless something explicitly constrains it. A column
  // Secondary's measurement wrapper would just hug its own content's
  // height, making "available vs. required" self-referential — any one
  // bad reading during a fast resize can permanently stick it collapsed.
  const selfMeasures = isRoot && direction === 'row' && selfMeasure
  const entries = useRef(new Map<string, MinSizeEntry>())
  const lastAvailableSize = useRef(0)
  const hasMeasured = useRef(false)
  const [ownCollapsed, setOwnCollapsed] = useState(false)
  const [footprint, setFootprint] = useState<MinSizeEntry | null>(null)
  const measureRef = useRef<HTMLDivElement>(null)

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
      for (const entry of entries.current.values()) {
        requiredExpanded += entry.expanded
      }
      const itemCount = entries.current.size
      const gap = computeSize(layer, GAP_SCALE)
      const gapTotal = gap * Math.max(0, itemCount - 1)
      const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
      requiredExpanded += gapTotal + paddingTotal

      setFootprint((previous) =>
        previous && previous.expanded === requiredExpanded
          ? previous
          : { expanded: requiredExpanded },
      )

      if (selfMeasures && hasMeasured.current) {
        setOwnCollapsed(availableSize < requiredExpanded)
      }
    },
    [layer, selfMeasures, GAP_SCALE, PADDING_SCALE],
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

  // recompute only ever runs in reaction to a registration event or a real
  // ResizeObserver reading — neither fires just because gap/padding
  // changed (e.g. a live Settings edit), so this re-runs it directly
  // whenever recompute's own identity changes for that reason.
  useEffect(() => {
    recompute(lastAvailableSize.current)
  }, [recompute])

  useEffect(() => {
    if (!selfMeasures) return
    const node = measureRef.current
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

  const collapsed = (selfMeasures ? ownCollapsed : ancestorCollapsed) || forceCollapsed

  // Reordering visibly moves the dragged item's DOM node to a new sibling
  // position on every step — and moving a node that holds native pointer
  // capture makes the browser silently drop that capture mid-drag (visible
  // as a 'lostpointercapture' event with no reorder-related cause of our
  // own). Once capture is gone, the eventual pointerup gets routed by
  // ordinary hit-testing to whatever's under the cursor instead of the
  // item that started the drag, so its own pointerup handler never fires
  // and the drag looks permanently stuck. Tracking the drag via window-
  // level listeners sidesteps this entirely: delivery no longer depends on
  // which element is under the cursor or where the dragged node currently
  // sits in the tree.
  const activeDragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => activeDragCleanupRef.current?.()
  }, [])

  const handleItemPointerDown = useCallback(
    (key: string, naturalOrder: string[]) => () => {
      if (!onReorder) return
      reorderStateRef.current = { key, order: naturalOrder }
      setDragOrder(naturalOrder)

      const endDrag = (commit: boolean) => {
        const state = reorderStateRef.current
        reorderStateRef.current = null
        setDragOrder(null)
        window.removeEventListener('pointermove', onWindowPointerMove)
        window.removeEventListener('pointerup', onWindowPointerUp)
        window.removeEventListener('pointercancel', onWindowPointerCancel)
        activeDragCleanupRef.current = null
        if (commit && state) onReorder?.(state.order)
      }

      const onWindowPointerMove = (moveEvent: PointerEvent) => {
        const state = reorderStateRef.current
        if (!state) return
        // event.buttons is the live truth of whether a button is still
        // held — a fallback in case even a window-level pointerup ever
        // goes missing (e.g. focus leaving the document entirely).
        if (moveEvent.buttons === 0) {
          endDrag(true)
          return
        }
        const pointerPos = direction === 'row' ? moveEvent.clientX : moveEvent.clientY
        const order = [...state.order]
        const draggedIndex = order.indexOf(state.key)
        let targetIndex = draggedIndex

        order.forEach((orderKey, index) => {
          if (orderKey === state.key) return
          const el = itemRefs.current.get(orderKey)
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
      }

      const onWindowPointerUp = () => endDrag(true)
      // A cancelled gesture is an abort, not an intentional drop — revert
      // to the caller's actual order instead of committing the preview.
      const onWindowPointerCancel = () => endDrag(false)

      window.addEventListener('pointermove', onWindowPointerMove)
      window.addEventListener('pointerup', onWindowPointerUp)
      window.addEventListener('pointercancel', onWindowPointerCancel)
      activeDragCleanupRef.current = () => endDrag(false)
    },
    [onReorder, direction],
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

  // A self-measuring root additionally renders an outer measurement
  // wrapper (below) — className/style belong on whichever element is
  // genuinely outermost, so a caller can position/style a <Secondary>
  // as one atomic unit without needing to know that split exists. For a
  // self-measuring root they're applied to the wrapper instead (merged
  // with its own required width/maxWidth), not duplicated here.
  const flexRow = (
    <div
      className={selfMeasures ? undefined : className}
      style={{
        display: 'flex',
        flexDirection: direction,
        // Hugs its content's width instead of filling its parent by
        // default (matching what a toolbar should look like) — except a
        // self-measuring root has no parent stretch to speak of, and a
        // Secondary nested inside a column-direction parent stretches to
        // match its widest sibling the same way Button/Input do, rather
        // than each section sizing to its own content independently.
        width: !selfMeasures && parentDirection === 'column' ? '100%' : 'fit-content',
        maxWidth: '100%',
        // Its own padding must count toward width/maxWidth, not sit outside
        // them — with the default content-box, a maxWidth: 100% cap still
        // lets padding push the real rendered box past the available space
        // by exactly the padding amount, since content-box percentages
        // ignore padding entirely.
        boxSizing: 'border-box',
        gap: computeSize(layer, GAP_SCALE),
        padding,
        borderRadius: padding * RADIUS_RATIO,
        backgroundColor: toCssColor(background),
        color: toCssColor(ink),
        overflowX: direction === 'row' ? 'auto' : 'hidden',
        overflowY: direction === 'row' ? 'hidden' : 'auto',
        // This is the visible, styled box — it's always the real
        // interactive surface even when a self-measuring root wraps it in
        // an outer shell that's purely for measurement (see below).
        pointerEvents: 'auto',
        ...(selfMeasures ? null : style),
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
              // It has no visible content of its own (which is often much
              // narrower than the true available space it measures), so it
              // never intercepts pointer events itself — only the visible
              // row above does — otherwise it'd swallow clicks across
              // space nothing is actually rendered in, e.g. when floated
              // over a canvas meant to stay click-through in the gaps.
              // The caller's own style is spread after the required width/
              // maxWidth/pointerEvents so it can extend (e.g. position it,
              // add margin) without needing to know this wrapper exists.
              <div
                ref={measureRef}
                className={className}
                style={{ width: '100%', maxWidth: '100%', pointerEvents: 'none', ...style }}
              >
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
