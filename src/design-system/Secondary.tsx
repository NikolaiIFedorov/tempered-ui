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
import { useOwnedSize } from './useOwnedSize'

export interface SecondaryProps {
  direction?: 'row' | 'column'
  hidden?: boolean
  // Only Secondary components are user-resizable — grants this Secondary
  // itself a drag handle. Primary children never resize independently.
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
  // inherits its collapse state from its ancestor, unless it's been
  // explicitly resized (see ownCollapsedFromDrag below).
  const isRoot = layer === 0
  // Even for the root, viewport self-measurement only makes sense for
  // direction: "row" — a block element always gets a genuine width from
  // its containing block in ordinary page flow, but its height is
  // intrinsic (auto) unless something explicitly constrains it. A column
  // Secondary's measurement wrapper would just hug its own content's
  // height, making "available vs. required" self-referential — any one
  // bad reading during a fast resize can permanently stick it collapsed.
  const selfMeasures = isRoot && direction === 'row'
  const entries = useRef(new Map<string, MinSizeEntry>())
  const lastAvailableSize = useRef(0)
  const hasMeasured = useRef(false)
  const [ownCollapsed, setOwnCollapsed] = useState(false)
  const [footprint, setFootprint] = useState<MinSizeEntry | null>(null)

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
      const itemCount = entries.current.size + (resizable ? 1 : 0)
      const gap = computeSize(layer, GAP_SCALE)
      const gapTotal = gap * Math.max(0, itemCount - 1)
      const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
      const handleTotal = resizable ? HANDLE_WIDTH : 0
      requiredExpanded += gapTotal + paddingTotal + handleTotal
      requiredCollapsed += gapTotal + paddingTotal + handleTotal

      setFootprint((previous) =>
        previous &&
        previous.expanded === requiredExpanded &&
        previous.collapsed === requiredCollapsed
          ? previous
          : { expanded: requiredExpanded, collapsed: requiredCollapsed },
      )

      if (selfMeasures && hasMeasured.current) {
        setOwnCollapsed(availableSize < requiredExpanded)
      }
    },
    [layer, selfMeasures, resizable],
  )

  // This Secondary's own size — owned locally like everything else, via
  // the same hook a resizable Primary uses, rather than the bespoke drag
  // state this used to carry. Only the root also feeds a real
  // ResizeObserver reading through this same pipeline (below); a nested
  // Secondary's size here is driven purely by the user's drag, if any.
  const owned = useOwnedSize<HTMLDivElement>(footprint?.expanded ?? 0, {
    axis: 'x',
    min: footprint?.collapsed ?? 0,
    enabled: resizable,
  })

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
    const node = owned.ref.current
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute, selfMeasures, owned.ref])

  // A nested Secondary that's been explicitly dragged narrower than its
  // own required width collapses its own Primaries, independent of its
  // ancestor — this doesn't need self-measurement's safety concerns
  // because the size came from direct pointer input, not from the box
  // observing its own rendered size.
  const ownCollapsedFromDrag =
    !selfMeasures && owned.isOverridden ? owned.size < (footprint?.expanded ?? 0) : false
  const collapsed = selfMeasures ? ownCollapsed : ancestorCollapsed || ownCollapsedFromDrag

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

  const flexRow = (
    <div
      ref={selfMeasures ? undefined : owned.ref}
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        // Hugs its content's width instead of filling its parent (matching
        // what a toolbar should look like), but still clamps down to the
        // parent's real available space when that's smaller — unless the
        // user has explicitly dragged this Secondary wider/narrower.
        width: !selfMeasures && owned.isOverridden ? owned.size : 'fit-content',
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
      {resizable && owned.handleProps ? (
        <div
          role="separator"
          aria-orientation="vertical"
          {...owned.handleProps}
          style={{
            flexShrink: 0,
            alignSelf: 'stretch',
            width: HANDLE_WIDTH,
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
              <div
                ref={owned.ref}
                style={{ width: owned.isOverridden ? owned.size : '100%', maxWidth: '100%' }}
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
