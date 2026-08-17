import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollapsed } from './layer'
import {
  useMinSizeRegistration,
  useNaturalCollapsedWidthRegistration,
  useNaturalHeightRegistration,
  useNaturalWidthRegistration,
} from './registry'
// These tests exercise Secondary's internal collapse/registration engine
// directly via synthetic probe components (ChildProbe/NaturalWidthProbe,
// below) rather than real Primaries — SecondaryImpl is the untyped engine
// Secondary's public `items` API delegates to; see Secondary.tsx for why
// app code should use Secondary instead.
import { Secondary as PublicSecondary, SecondaryImpl as Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'
import { TokensProvider, useSetTokens } from './TokensProvider'

function ChildProbe({
  label,
  expanded,
  naturalHeight,
  naturalWidth,
  naturalCollapsedWidth,
}: {
  label: string
  expanded: number
  naturalHeight?: number
  naturalWidth?: number
  naturalCollapsedWidth?: number
}) {
  useMinSizeRegistration({ expanded })
  useNaturalHeightRegistration(naturalHeight ?? null)
  useNaturalWidthRegistration(naturalWidth ?? null)
  useNaturalCollapsedWidthRegistration(naturalCollapsedWidth ?? null)
  const isCollapsed = useCollapsed()
  return <div data-testid={label}>{String(isCollapsed)}</div>
}

function NaturalWidthProbe({ width }: { width: number }) {
  useNaturalWidthRegistration(width)
  return null
}

beforeEach(() => {
  FakeResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function TokenEditor({ children }: { children: ReactNode }) {
  const setTokens = useSetTokens()
  return (
    <div>
      <button onClick={() => setTokens((previous) => ({ ...previous, padding: 500 }))}>
        grow padding
      </button>
      {children}
    </div>
  )
}

describe('Secondary reacts to live token changes', () => {
  // recompute only used to run in reaction to a registration event or a
  // real ResizeObserver reading — a token changing alone (e.g. a live
  // Settings edit) wasn't either of those, so without re-running it
  // explicitly when the token itself changes, the collapse threshold
  // would silently go stale until something unrelated happened to
  // trigger a recompute anyway.
  it('re-derives its collapse threshold when a token changes, without any new registration or resize event', () => {
    render(
      <TokensProvider>
        <TokenEditor>
          <Secondary>
            <ChildProbe label="a" expanded={50} />
          </Secondary>
        </TokenEditor>
      </TokensProvider>,
    )

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 200, height: 40 })
    })
    expect(screen.getByTestId('a')).toHaveTextContent('false')

    act(() => {
      fireEvent.click(screen.getByText('grow padding'))
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
  })
})

describe('Secondary forceCollapsed', () => {
  it('collapses a column-direction root even though it never self-measures on its own', () => {
    render(
      <Secondary direction="column" forceCollapsed>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    expect(screen.getByTestId('a')).toHaveTextContent('true')
  })

  it('collapses a row-direction root before any real measurement would', () => {
    render(
      <Secondary forceCollapsed>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    expect(screen.getByTestId('a')).toHaveTextContent('true')
  })

  it('ORs with (never overrides away) a collapse the Secondary would already reach on its own', () => {
    const { container } = render(
      <Secondary forceCollapsed={false}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 10, height: 40 })
    })
    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(container).toBeInTheDocument()
  })

  it('does not attach a ResizeObserver on a row-direction root when selfMeasure is false', () => {
    render(
      <Secondary selfMeasure={false}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    expect(FakeResizeObserver.instances).toHaveLength(0)
  })

  it('relies purely on forceCollapsed for a row-direction root with selfMeasure disabled, so it cannot flip independently of siblings driven by the same shared signal', () => {
    const { rerender } = render(
      <Secondary selfMeasure={false} forceCollapsed={false}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    expect(screen.getByTestId('a')).toHaveTextContent('false')

    rerender(
      <Secondary selfMeasure={false} forceCollapsed={true}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )
    expect(screen.getByTestId('a')).toHaveTextContent('true')
  })
})

describe('Secondary collapse', () => {
  it("stays expanded while available space covers the sum of children's expanded min sizes", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <ChildProbe label="b" expanded={50} />
      </Secondary>,
    )

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 200, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('false')
    expect(screen.getByTestId('b')).toHaveTextContent('false')
  })

  it('collapses every child at once when available space drops below the required sum', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <ChildProbe label="b" expanded={50} />
      </Secondary>,
    )

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 60, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('b')).toHaveTextContent('true')
  })

  it('expands again once available space recovers', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <ChildProbe label="b" expanded={50} />
      </Secondary>,
    )

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 60, height: 40 })
    })
    expect(screen.getByTestId('a')).toHaveTextContent('true')

    act(() => {
      observer.trigger({ width: 200, height: 40 })
    })
    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })

  it('stays expanded before the first real measurement arrives, even though the required sum is unknown', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <ChildProbe label="b" expanded={50} />
      </Secondary>,
    )

    expect(screen.getByTestId('a')).toHaveTextContent('false')
    expect(screen.getByTestId('b')).toHaveTextContent('false')
  })

  it('does not render its children when hidden', () => {
    render(
      <Secondary hidden>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    expect(screen.queryByTestId('a')).not.toBeInTheDocument()
  })
})

describe('className/style targeting', () => {
  // A row-direction root additionally renders an outer, invisible
  // measurement wrapper around the visually-styled row — className/style
  // must reach whichever element is genuinely outermost, so a caller can
  // treat <Secondary> as one atomic unit (position it, add margin) without
  // knowing that split exists.
  it('applies className/style to the outer measurement wrapper on a row-direction root', () => {
    const { container } = render(
      <Secondary className="my-class" style={{ marginTop: 12 }}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    const outer = container.firstChild as HTMLElement
    expect(outer.className).toBe('my-class')
    expect(outer).toHaveStyle({ marginTop: '12px' })
    // The required measurement styles must still be present, not clobbered.
    expect(outer).toHaveStyle({ width: '100%', maxWidth: '100%' })
  })

  // The measurement wrapper has no visible content of its own — its true
  // available-space width is often much larger than the visible row inside
  // it (e.g. a small floating panel measured against a full canvas), so it
  // must never intercept pointer events itself, or it'd swallow clicks
  // across space nothing is actually rendered in.
  it('never lets the invisible measurement wrapper intercept pointer events, only the visible row', () => {
    const { container } = render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    const wrapper = container.firstChild as HTMLElement
    const row = wrapper.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ pointerEvents: 'none' })
    expect(row).toHaveStyle({ pointerEvents: 'auto' })
  })

  it('applies className/style directly to the row for a column-direction (non-self-measuring) Secondary', () => {
    const { container } = render(
      <Secondary direction="column" className="my-class" style={{ marginTop: 12 }}>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    const outer = container.firstChild as HTMLElement
    expect(outer.className).toBe('my-class')
    expect(outer).toHaveStyle({ marginTop: '12px', display: 'flex' })
  })

  it('applies className/style directly to the row for a nested (non-self-measuring) Secondary', () => {
    const { container } = render(
      <Secondary>
        <Secondary className="my-class" style={{ marginTop: 12 }}>
          <ChildProbe label="a" expanded={50} />
        </Secondary>
      </Secondary>,
    )

    const nestedRow = (container.firstChild as HTMLElement).querySelector('.my-class')
    expect(nestedRow).not.toBeNull()
    expect(nestedRow).toHaveStyle({ marginTop: '12px', display: 'flex' })
  })
})

describe('column-direction root Secondary', () => {
  it('never self-measures — a block element has no genuine external height constraint in ordinary flow', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={9999} />
      </Secondary>,
    )

    // No ResizeObserver at all — there is nothing to measure against.
    expect(FakeResizeObserver.instances).toHaveLength(0)
    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })

  it('stays expanded regardless of how large its children register, avoiding the self-referential trap', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={100000} />
      </Secondary>,
    )

    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })
})

describe('nested Secondary collapse cascade', () => {
  it("cascades collapse into a nested Secondary's primaries when the ancestor collapses", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} />
        </Secondary>
      </Secondary>,
    )

    // A nested Secondary has no ResizeObserver of its own — only the root does.
    const [outerObserver] = FakeResizeObserver.instances
    act(() => {
      outerObserver.trigger({ width: 40, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('nested')).toHaveTextContent('true')
  })

  it('does not run its own squeeze detection — a nested Secondary only ever reflects its ancestor', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={10} />
        <Secondary>
          <ChildProbe label="nested" expanded={50} />
        </Secondary>
      </Secondary>,
    )

    // Only one ResizeObserver exists at all (the root's); there is nothing
    // to trigger on the nested Secondary even if its own content is large.
    expect(FakeResizeObserver.instances).toHaveLength(1)

    const [outerObserver] = FakeResizeObserver.instances
    act(() => {
      outerObserver.trigger({ width: 200, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('false')
    expect(screen.getByTestId('nested')).toHaveTextContent('false')
  })

  it('expands the nested Secondary again once the ancestor recovers space, without getting stuck', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} />
        </Secondary>
      </Secondary>,
    )

    const [outerObserver] = FakeResizeObserver.instances

    act(() => {
      outerObserver.trigger({ width: 40, height: 40 })
    })
    expect(screen.getByTestId('nested')).toHaveTextContent('true')

    act(() => {
      outerObserver.trigger({ width: 200, height: 40 })
    })
    expect(screen.getByTestId('nested')).toHaveTextContent('false')
  })

  it("counts a nested Secondary's own footprint toward its ancestor's collapse threshold", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={10} />
        <Secondary>
          <ChildProbe label="nested" expanded={100} />
        </Secondary>
      </Secondary>,
    )

    const [outerObserver] = FakeResizeObserver.instances

    // "a" alone (10) plus a gap easily fits in 60px, but the nested
    // Secondary's own expanded footprint (~100) does not — the ancestor
    // must still collapse to account for it.
    act(() => {
      outerObserver.trigger({ width: 60, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('nested')).toHaveTextContent('true')
  })
})

describe('Secondary natural width aggregation', () => {
  it('sums children natural widths plus gaps and padding for a row root', () => {
    const onNaturalWidthChange = vi.fn()
    render(
      <Secondary onNaturalWidthChange={onNaturalWidthChange}>
        <NaturalWidthProbe width={50} />
        <NaturalWidthProbe width={30} />
      </Secondary>,
    )

    // layer 0: gap = padding = 12, padding total = 12*2 = 24 — 50 + 30 + 12 + 24 = 116.
    expect(onNaturalWidthChange).toHaveBeenCalledWith(116)
  })

  it("takes the max across children's natural widths (not their sum) for a column root, since they stretch to the widest one rather than stacking side by side", () => {
    const onNaturalWidthChange = vi.fn()
    render(
      <Secondary direction="column" onNaturalWidthChange={onNaturalWidthChange}>
        <NaturalWidthProbe width={50} />
        <NaturalWidthProbe width={90} />
      </Secondary>,
    )

    // layer 0: padding = 12*2 = 24 — max(50, 90) + 24 = 114. No gap: gaps
    // separate stacked rows, they don't contribute to a column's width.
    expect(onNaturalWidthChange).toHaveBeenCalledWith(114)
  })

  it("folds a nested Secondary's own aggregate natural width into its ancestor's, instead of ignoring the subtree", () => {
    const onNaturalWidthChange = vi.fn()
    render(
      <Secondary onNaturalWidthChange={onNaturalWidthChange}>
        <NaturalWidthProbe width={10} />
        <Secondary direction="column">
          <NaturalWidthProbe width={40} />
          <NaturalWidthProbe width={70} />
        </Secondary>
      </Secondary>,
    )

    // Padding is a flat constant (12), the same at every layer — nested
    // column Secondary's own natural width: max(40, 70) + 2*12 = 94.
    // Root (row, layer 0): 10 + 94 + gap (12, = padding) + padding (24) = 140.
    expect(onNaturalWidthChange).toHaveBeenLastCalledWith(140)
  })

  it('reports no natural width requirement when nothing in the subtree registers one (e.g. Paragraph-only content), the same way min-size registration is skipped', () => {
    const onNaturalWidthChange = vi.fn()
    render(<Secondary onNaturalWidthChange={onNaturalWidthChange}>{null}</Secondary>)

    expect(onNaturalWidthChange).not.toHaveBeenCalled()
  })

  it('re-derives its natural width when a token changes, without any new registration', () => {
    const onNaturalWidthChange = vi.fn()
    render(
      <TokensProvider>
        <TokenEditor>
          <Secondary onNaturalWidthChange={onNaturalWidthChange}>
            <NaturalWidthProbe width={50} />
          </Secondary>
        </TokenEditor>
      </TokensProvider>,
    )

    // layer 0, single item: no inter-item gap — 50 + padding (24) = 74.
    expect(onNaturalWidthChange).toHaveBeenLastCalledWith(74)

    act(() => {
      fireEvent.click(screen.getByText('grow padding'))
    })

    expect(onNaturalWidthChange.mock.calls.at(-1)?.[0]).toBeGreaterThan(70)
  })
})

describe('Secondary overflow (scroll fallback for when even collapsed children do not fit)', () => {
  it('scrolls along the row axis and clips the cross axis by default', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    // The styled row is one level inside the always-100%-wide measurement
    // wrapper — it's the row that scrolls, not the wrapper.
    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      overflowX: 'auto',
      overflowY: 'hidden',
    })
  })

  it('scrolls along the column axis and clips the cross axis when direction is column', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      overflowX: 'hidden',
      overflowY: 'auto',
    })
  })

  it('keeps each child from flex-shrinking below its own size, so overflow scrolls instead of squashing content', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    expect(screen.getByTestId('a').parentElement).toHaveStyle({
      flexShrink: '0',
    })
  })

  it('floors the row at its expanded content width while not collapsed, so a flexible ancestor track cannot squeeze it into a premature scroll', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    // layer 0, single item: no inter-item gap — 50 + padding (24) = 74,
    // the same total Secondary.recompute derives as requiredExpanded.
    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      minWidth: '74px',
    })
  })

  it('releases that floor once collapsed, letting the fallback scroll engage', () => {
    render(
      <Secondary forceCollapsed>
        <ChildProbe label="a" expanded={50} />
      </Secondary>,
    )

    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).not.toHaveStyle({
      minWidth: '74px',
    })
  })

  it('floors a row-direction root at its own required height, so a CSS Grid caller cannot stretch it down to a shorter row track and clip it', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} naturalHeight={30} />
      </Secondary>,
    )

    // layer 0, single item: max child height (30) + padding (24) = 54.
    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      minHeight: '54px',
    })
  })

  it('leaves the cross-axis floor unset for a nested (non-root) row, which is a plain flex child rather than a grid item', () => {
    render(
      <Secondary direction="column">
        <Secondary>
          <ChildProbe label="a" expanded={50} naturalHeight={30} />
        </Secondary>
      </Secondary>,
    )

    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).not.toHaveStyle({
      minHeight: '54px',
    })
  })

  it('releases the row cross-axis floor once collapsed, letting the fallback scroll engage', () => {
    render(
      <Secondary forceCollapsed>
        <ChildProbe label="a" expanded={50} naturalHeight={30} />
      </Secondary>,
    )

    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).not.toHaveStyle({
      minHeight: '54px',
    })
  })

  it('floors a column-direction root at its own expanded width while not collapsed, so a CSS Grid caller cannot squeeze it below its labels', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={50} naturalWidth={80} naturalCollapsedWidth={20} />
      </Secondary>,
    )

    // layer 0, single item: naturalWidthFootprint = 80 + padding (24) = 104.
    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      minWidth: '104px',
    })
  })

  it('switches a column-direction root to its collapsed (icon-only) width floor once collapsed, rather than releasing it — there is no scroll fallback on this axis', () => {
    render(
      <Secondary direction="column" forceCollapsed>
        <ChildProbe label="a" expanded={50} naturalWidth={80} naturalCollapsedWidth={20} />
      </Secondary>,
    )

    // naturalCollapsedWidthFootprint = 20 + padding (24) = 44.
    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).toHaveStyle({
      minWidth: '44px',
    })
  })

  it('leaves the column cross-axis floor unset for a nested (non-root) column, which is a plain flex child rather than a grid item', () => {
    render(
      <Secondary>
        <Secondary direction="column">
          <ChildProbe label="a" expanded={50} naturalWidth={80} naturalCollapsedWidth={20} />
        </Secondary>
      </Secondary>,
    )

    expect(screen.getByTestId('a').closest('div[style*="overflow"]')).not.toHaveStyle({
      minWidth: '104px',
    })
  })
})

describe('drag-to-reorder', () => {
  // Lays out three items left-to-right: a=[0,100], b=[100,200], c=[200,300].
  const RECTS: Record<string, { left: number; right: number; top: number; bottom: number }> = {
    a: { left: 0, right: 100, top: 0, bottom: 40 },
    b: { left: 100, right: 200, top: 0, bottom: 40 },
    c: { left: 200, right: 300, top: 0, bottom: 40 },
  }

  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    // jsdom doesn't implement the Web Animations API the boundary bounce
    // uses (Secondary.tsx feature-detects it for exactly this reason) — a
    // plain mock lets these tests observe whether/how often it's called.
    HTMLElement.prototype.animate = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const key = this.getAttribute('data-key')
      const rect = key ? RECTS[key] : undefined
      return {
        width: 100,
        height: 40,
        ...(rect ?? { left: 0, right: 0, top: 0, bottom: 0 }),
      } as DOMRect
    })
  })

  function itemWrapper(container: HTMLElement, key: string) {
    return container.querySelector(`[data-key="${key}"]`) as HTMLElement
  }

  it('does not attach drag handlers when onReorder is not provided', () => {
    const { container } = render(
      <Secondary>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
      </Secondary>,
    )
    const a = itemWrapper(container, 'a')
    expect(a.style.cursor).toBe('')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(a, { pointerId: 1 })
    // Nothing should have moved — order in the DOM stays natural.
    expect(screen.getAllByTestId(/[abc]/).map((el) => el.dataset.testid)).toEqual(['a', 'b'])
  })

  it('reorders past a sibling once dragged beyond its midpoint, and reports the new order on release', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <Secondary onReorder={onReorder}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    // b's midpoint is at x=150; 160 is past it.
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(a, { pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('still commits and clears the dimmed state when the release lands on a different element entirely', () => {
    // Reordering moves the dragged item's own DOM node to a new sibling
    // position on every step, which makes real browsers silently drop
    // native pointer capture mid-drag — so the eventual pointerup can land
    // on whatever's actually under the cursor rather than the item that
    // started the drag. Tracking is done via window-level listeners
    // specifically so this still works.
    const onReorder = vi.fn()
    const { container } = render(
      <Secondary onReorder={onReorder}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })
    expect(a.style.opacity).toBe('0.5')

    // Release somewhere entirely unrelated to any item.
    fireEvent.pointerUp(document.body, { pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
    expect(a.style.opacity).toBe('1')
  })

  it('shows a live preview order during the drag, before pointerup', () => {
    const { container } = render(
      <Secondary onReorder={vi.fn()}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })

    const order = screen.getAllByTestId(/[abc]/).map((el) => el.dataset.testid)
    expect(order).toEqual(['b', 'a', 'c'])
  })

  it('does not reorder when dragged only slightly, staying within the same slot', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <Secondary onReorder={onReorder}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 55, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(a, { pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(['a', 'b'])
  })

  it('stops the drag as soon as a move reveals the button was already released, even with no matching pointerup', () => {
    // Mirrors the real-world failure: a pointerup can go missing (window
    // blur, a native drag interrupting capture, etc.). Without this check,
    // the item stays visually dimmed and any later hover would keep
    // reordering it, since reorderStateRef never got cleared.
    const onReorder = vi.fn()
    const { container } = render(
      <Secondary onReorder={onReorder}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })
    expect(a.style.opacity).toBe('0.5')

    // No pointerup fired — just a stray move with no button held, as if
    // the release happened somewhere pointer capture didn't route it.
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 0 })
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
    expect(a.style.opacity).toBe('1')

    // Further hover-only movement must not reorder anything else.
    onReorder.mockClear()
    const b = itemWrapper(container, 'b')
    fireEvent.pointerMove(b, { clientX: 250, pointerId: 1, buttons: 0 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('reverts to the natural order on pointercancel, without committing the preview', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <Secondary onReorder={onReorder}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })
    expect(screen.getAllByTestId(/[abc]/).map((el) => el.dataset.testid)).toEqual(['b', 'a', 'c'])

    fireEvent.pointerCancel(a, { pointerId: 1 })

    expect(onReorder).not.toHaveBeenCalled()
    expect(a.style.opacity).toBe('1')
    expect(screen.getAllByTestId(/[abc]/).map((el) => el.dataset.testid)).toEqual(['a', 'b', 'c'])
  })

  it('plays a boundary bounce once when the pointer pushes past the last position, not again while it stays past it', () => {
    const { container } = render(
      <Secondary onReorder={vi.fn()}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    // c is already the last item — nothing to reorder past. b's own
    // trailing edge (the furthest of the two other items) is at x=200.
    const c = itemWrapper(container, 'c')
    fireEvent.pointerDown(c, { clientX: 250, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(c, { clientX: 250, pointerId: 1, buttons: 1 })
    expect(c.animate).toHaveBeenCalledOnce()

    // Still pushing past the same boundary — must not re-trigger.
    fireEvent.pointerMove(c, { clientX: 260, pointerId: 1, buttons: 1 })
    expect(c.animate).toHaveBeenCalledOnce()
  })

  it('resets the boundary bounce once the pointer returns within bounds, so a re-crossing plays it again', () => {
    const { container } = render(
      <Secondary onReorder={vi.fn()}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const c = itemWrapper(container, 'c')
    fireEvent.pointerDown(c, { clientX: 250, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(c, { clientX: 250, pointerId: 1, buttons: 1 })
    expect(c.animate).toHaveBeenCalledOnce()

    // Back within bounds (b's own midpoint) — no reorder happens either,
    // since c is already the last slot, but the boundary flag clears.
    fireEvent.pointerMove(c, { clientX: 150, pointerId: 1, buttons: 1 })
    expect(c.animate).toHaveBeenCalledOnce()

    // Crossing back out plays it again.
    fireEvent.pointerMove(c, { clientX: 250, pointerId: 1, buttons: 1 })
    expect(c.animate).toHaveBeenCalledTimes(2)
  })

  it('does not play the boundary bounce when the move actually reorders', () => {
    const { container } = render(
      <Secondary onReorder={vi.fn()}>
        <ChildProbe key="a" label="a" expanded={10} />
        <ChildProbe key="b" label="b" expanded={10} />
        <ChildProbe key="c" label="c" expanded={10} />
      </Secondary>,
    )

    const a = itemWrapper(container, 'a')
    fireEvent.pointerDown(a, { clientX: 50, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(a, { clientX: 160, pointerId: 1, buttons: 1 })

    expect(a.animate).not.toHaveBeenCalled()
  })
})

describe('public Secondary (items API)', () => {
  it('renders each item kind via the real Button/Input/Paragraph/Secondary components', () => {
    render(
      <PublicSecondary
        items={[
          { kind: 'button', key: 'save', props: { label: 'Save' } },
          { kind: 'paragraph', key: 'hint', props: { children: 'Unsaved changes' } },
          {
            kind: 'secondary',
            key: 'nested',
            props: { items: [{ kind: 'input', props: { label: 'Width', value: '1', onChange() {} } }] },
          },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('1')
  })

  // Never rendered — this only needs to exist for `tsc -b` to type-check
  // it. Unlike an approach based on JSX element types (ruled out earlier:
  // every JSX tag's static type erases to ReactElement<any, any>, so
  // nothing distinguishes a <Button> from a <div> once either is written),
  // `items` is plain structural data, so TypeScript really does check it —
  // this `@ts-expect-error` is a real assertion: if `kind`/`props` checking
  // is ever weakened, the directive itself starts failing the build,
  // catching the regression the same way any other compile-time
  // constraint would.
  function typeCheckOnly() {
    return (
      <>
        <PublicSecondary items={[{ kind: 'button', props: { label: 'Save' } }]} />
        {/* @ts-expect-error 'div' is not a valid SecondaryItem kind */}
        <PublicSecondary items={[{ kind: 'div', props: {} }]} />
        <PublicSecondary
          items={[
            // @ts-expect-error ButtonProps requires `label`
            { kind: 'button', props: {} },
          ]}
        />
      </>
    )
  }

  it('exists only to be type-checked, not run', () => {
    expect(typeof typeCheckOnly).toBe('function')
  })
})
