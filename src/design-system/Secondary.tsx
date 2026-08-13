import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import { Input, type InputProps } from './Input'
import {
  CollapseProvider,
  DirectionProvider,
  LayerProvider,
  useCollapsed,
  useOwnSecondaryLayer,
  useSecondaryDirection,
} from './layer'
import { Paragraph, type ParagraphProps } from './Paragraph'
import {
  type MinSizeEntry,
  MinSizeRegistryProvider,
  NaturalCollapsedWidthRegistryProvider,
  NaturalHeightRegistryProvider,
  NaturalWidthRegistryProvider,
  useMinSizeRegistration,
  useNaturalCollapsedWidthRegistration,
  useNaturalHeightRegistration,
  useNaturalWidthRegistration,
} from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'
import { useTokens } from './TokensProvider'

// Every kind of item a Secondary can hold, as plain data rather than a
// JSX element — a JSX expression's static type is always erased to
// ReactElement<any, any> (see JSX.Element), so a prop typed to accept
// "only these components' elements" can't actually be enforced; TypeScript
// can no longer tell a <Button> apart from a <div> once either has been
// written as a tag. Structural data doesn't have that problem: `props`
// below is checked against the real ButtonProps/InputProps/ParagraphProps
// interface, so a call site that gets a required field wrong (or invents a
// `kind` that doesn't exist) fails to compile. Secondary is the only place
// that ever turns this data into actual elements (renderSecondaryItem,
// below) — nothing upstream needs to.
export type PrimaryItem =
  | { kind: 'button'; key?: string; props: ButtonProps }
  | { kind: 'input'; key?: string; props: InputProps }
  | { kind: 'paragraph'; key?: string; props: ParagraphProps }

export type SecondaryItem = PrimaryItem | { kind: 'secondary'; key?: string; props: SecondaryProps }

function renderSecondaryItem(item: SecondaryItem): ReactElement {
  switch (item.kind) {
    case 'button':
      return <Button key={item.key} {...item.props} />
    case 'input':
      return <Input key={item.key} {...item.props} />
    case 'paragraph':
      return <Paragraph key={item.key} {...item.props} />
    case 'secondary':
      return <Secondary key={item.key} {...item.props} />
  }
}

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
  // Fires with this Secondary's own aggregate natural width — its rendered
  // width with nothing collapsed and nothing constraining it — whenever
  // that changes. Meaningful for any Secondary (nested ones already fold
  // this into their ancestor's own aggregate automatically), but the only
  // real use is a root with no ancestor registry to report to: a caller
  // coordinating several independent roots off one shared collapse signal
  // (the same role forceCollapsed plays) needs each root's own requirement
  // surfaced somehow, since there's nothing upstream to fold it into.
  onNaturalWidthChange?: (width: number) => void
  // Reordering is a controlled operation, the same way a controlled
  // <input> reports changes instead of owning its own value: Secondary
  // handles the drag gesture and live visual feedback, but the actual
  // list order lives wherever the caller's data already lives. Omit to
  // leave children un-draggable.
  onReorder?: (newOrder: string[]) => void
  items: SecondaryItem[]
  style?: CSSProperties
  className?: string
}

export function Secondary({ items, ...rest }: SecondaryProps) {
  return <SecondaryImpl {...rest}>{items.map(renderSecondaryItem)}</SecondaryImpl>
}

// The actual rendering/measurement engine, keyed off plain ReactNode
// children rather than the typed `items` above. Not meant for app code —
// Secondary (above) is the real public component, and is what every
// production call site should use. This stays exported specifically so
// tests can exercise the collapse/registration machinery directly with
// synthetic probe components (see Secondary.test.tsx), which the typed
// `items` union has no room for and shouldn't: those probes aren't real
// Primaries, they exist purely to isolate this machinery from a real
// Button/Input's own DOM measurement.
export function SecondaryImpl({
  direction = 'row',
  hidden = false,
  forceCollapsed = false,
  selfMeasure = true,
  onNaturalWidthChange,
  onReorder,
  children,
  style,
  className,
}: Omit<SecondaryProps, 'items'> & { children: ReactNode }) {
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
  // A second, independent aggregate — see NaturalWidthRegistry for why it
  // can't just reuse `entries`/`footprint` above: those always sum along
  // this Secondary's own direction (the axis its children stack on), but a
  // column's *width* is its cross axis, aggregated by max (children
  // stretch to the widest one) rather than sum.
  const naturalWidthEntries = useRef(new Map<string, number>())
  const [naturalWidthFootprint, setNaturalWidthFootprint] = useState<number | null>(null)
  // A third, independent aggregate, the same idea as naturalWidthEntries
  // but for the other axis — see registry.ts's NaturalHeightRegistry for
  // why a row-direction root needs its own required height tracked
  // separately from footprint.expanded (which is a width sum for a row,
  // not a height).
  const naturalHeightEntries = useRef(new Map<string, number>())
  const [naturalHeightFootprint, setNaturalHeightFootprint] = useState<number | null>(null)
  // A fourth, independent aggregate — see registry.ts's
  // NaturalCollapsedWidthRegistry for why a column root's cross-axis floor
  // needs its children's *collapsed* width, a different number from
  // naturalWidthFootprint above (which is always the uncollapsed one).
  const naturalCollapsedWidthEntries = useRef(new Map<string, number>())
  const [naturalCollapsedWidthFootprint, setNaturalCollapsedWidthFootprint] = useState<
    number | null
  >(null)

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

  const recomputeNaturalWidth = useCallback(() => {
    const widths = [...naturalWidthEntries.current.values()]
    const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
    if (widths.length === 0) {
      // Nothing in this subtree needs protecting (e.g. an all-Paragraph
      // section) — no natural width requirement to report, the same way
      // Paragraph itself never registers a min-size entry.
      setNaturalWidthFootprint(null)
      return
    }
    const width =
      direction === 'row'
        ? widths.reduce((sum, w) => sum + w, 0) +
          computeSize(layer, GAP_SCALE) * Math.max(0, widths.length - 1) +
          paddingTotal
        : Math.max(...widths) + paddingTotal
    setNaturalWidthFootprint((previous) => (previous === width ? previous : width))
  }, [layer, direction, GAP_SCALE, PADDING_SCALE])

  // Reports this Secondary's own aggregate natural width to its ancestor's
  // registry (a no-op for the root, which has no ancestor registry — see
  // onNaturalWidthChange for how a root instead surfaces this).
  useNaturalWidthRegistration(naturalWidthFootprint)

  useEffect(() => {
    if (naturalWidthFootprint !== null) onNaturalWidthChange?.(naturalWidthFootprint)
  }, [naturalWidthFootprint, onNaturalWidthChange])

  const naturalWidthRegistry = useMemo(
    () => ({
      register(id: string, width: number) {
        naturalWidthEntries.current.set(id, width)
        recomputeNaturalWidth()
      },
      unregister(id: string) {
        naturalWidthEntries.current.delete(id)
        recomputeNaturalWidth()
      },
    }),
    [recomputeNaturalWidth],
  )

  // Mirrors the min-size registry's own re-run below: a live token edit
  // changes gap/padding without any registration event or resize to
  // trigger off of, so this re-derives the aggregate directly whenever
  // recomputeNaturalWidth's own identity changes for that reason.
  useEffect(() => {
    recomputeNaturalWidth()
  }, [recomputeNaturalWidth])

  const recomputeNaturalHeight = useCallback(() => {
    const heights = [...naturalHeightEntries.current.values()]
    const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
    if (heights.length === 0) {
      setNaturalHeightFootprint(null)
      return
    }
    const height =
      direction === 'column'
        ? heights.reduce((sum, h) => sum + h, 0) +
          computeSize(layer, GAP_SCALE) * Math.max(0, heights.length - 1) +
          paddingTotal
        : Math.max(...heights) + paddingTotal
    setNaturalHeightFootprint((previous) => (previous === height ? previous : height))
  }, [layer, direction, GAP_SCALE, PADDING_SCALE])

  // Reports this Secondary's own aggregate natural height to its ancestor's
  // registry (a no-op for the root, which has no ancestor registry — a root
  // instead consumes its own naturalHeightFootprint directly, as the
  // row-direction minHeight floor below).
  useNaturalHeightRegistration(naturalHeightFootprint)

  const naturalHeightRegistry = useMemo(
    () => ({
      register(id: string, height: number) {
        naturalHeightEntries.current.set(id, height)
        recomputeNaturalHeight()
      },
      unregister(id: string) {
        naturalHeightEntries.current.delete(id)
        recomputeNaturalHeight()
      },
    }),
    [recomputeNaturalHeight],
  )

  useEffect(() => {
    recomputeNaturalHeight()
  }, [recomputeNaturalHeight])

  const recomputeNaturalCollapsedWidth = useCallback(() => {
    const widths = [...naturalCollapsedWidthEntries.current.values()]
    const paddingTotal = computeSize(layer, PADDING_SCALE) * 2
    if (widths.length === 0) {
      setNaturalCollapsedWidthFootprint(null)
      return
    }
    const width =
      direction === 'row'
        ? widths.reduce((sum, w) => sum + w, 0) +
          computeSize(layer, GAP_SCALE) * Math.max(0, widths.length - 1) +
          paddingTotal
        : Math.max(...widths) + paddingTotal
    setNaturalCollapsedWidthFootprint((previous) => (previous === width ? previous : width))
  }, [layer, direction, GAP_SCALE, PADDING_SCALE])

  // Reports this Secondary's own aggregate collapsed width to its ancestor's
  // registry (a no-op for the root, which has no ancestor registry — a root
  // instead consumes its own naturalCollapsedWidthFootprint directly, as the
  // column-direction minWidth floor below).
  useNaturalCollapsedWidthRegistration(naturalCollapsedWidthFootprint)

  const naturalCollapsedWidthRegistry = useMemo(
    () => ({
      register(id: string, width: number) {
        naturalCollapsedWidthEntries.current.set(id, width)
        recomputeNaturalCollapsedWidth()
      },
      unregister(id: string) {
        naturalCollapsedWidthEntries.current.delete(id)
        recomputeNaturalCollapsedWidth()
      },
    }),
    [recomputeNaturalCollapsedWidth],
  )

  useEffect(() => {
    recomputeNaturalCollapsedWidth()
  }, [recomputeNaturalCollapsedWidth])

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
        // overflow other than 'visible' on an axis zeroes that axis's
        // automatic minimum size, so a grid/flex ancestor track (misc's 1fr
        // column in App.tsx, sized independently of the shared forceCollapsed
        // signal) can squeeze this row narrower than its own content needs —
        // triggering this same overflow as a native scrollbar before the
        // collapse decision above ever fires. Restoring the floor while not
        // collapsed keeps that scrollbar what the tests below describe it as:
        // a fallback for when even the collapsed children don't fit.
        //
        // The cross axis has the same problem for a row-direction root: it
        // sits directly as a CSS Grid item in the caller's own grid
        // (App.tsx's chrome layout), where a row track sized 'auto' but
        // shared with a sibling spanning into a flexible 1fr track below it
        // (tools/settings) can be resolved shorter than this row's own
        // content — and the zeroed automatic minimum above lets it.
        // naturalHeightFootprint (this Secondary's own required height,
        // built the same way footprint.expanded is but for the cross axis)
        // supplies that floor. A CSS keyword like 'min-content' was tried
        // here first and didn't work — Chromium's grid auto-track sizing
        // didn't pick it up as a real minimum the way an explicit pixel
        // value does, so the track stayed undersized and the row, no longer
        // being squashed to match it, just overflowed into Settings instead
        // of being clipped by it.
        //
        // A column-direction root's cross axis is width too, and hits the
        // very same zeroed-automatic-minimum squeeze — but unlike a row,
        // there's no scroll fallback to release into once collapsed
        // (overflow-x here is 'hidden', not 'auto'), so the floor is never
        // released: it just switches from naturalWidthFootprint (this
        // Secondary's own required width with labels showing) to
        // naturalCollapsedWidthFootprint (the same, icon-only) once
        // forceCollapsed actually flips, so the box still visibly shrinks
        // on collapse — it just never shrinks past whatever it's currently
        // showing.
        minWidth:
          direction === 'row'
            ? !collapsed
              ? footprint?.expanded
              : undefined
            : isRoot
              ? ((collapsed ? naturalCollapsedWidthFootprint : naturalWidthFootprint) ?? undefined)
              : undefined,
        minHeight: !collapsed
          ? direction === 'column'
            ? footprint?.expanded
            : isRoot
              ? (naturalHeightFootprint ?? undefined)
              : undefined
          : undefined,
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
            <NaturalWidthRegistryProvider value={naturalWidthRegistry}>
              <NaturalHeightRegistryProvider value={naturalHeightRegistry}>
                <NaturalCollapsedWidthRegistryProvider value={naturalCollapsedWidthRegistry}>
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
                </NaturalCollapsedWidthRegistryProvider>
              </NaturalHeightRegistryProvider>
            </NaturalWidthRegistryProvider>
          </MinSizeRegistryProvider>
        </DirectionProvider>
      </CollapseProvider>
    </LayerProvider>
  )
}
