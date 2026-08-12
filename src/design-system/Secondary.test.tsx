import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollapsed } from './layer'
import { useMinSizeRegistration } from './registry'
import { Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'
import { TokensProvider, useSetTokens } from './TokensProvider'

function ChildProbe({ label, expanded }: { label: string; expanded: number }) {
  useMinSizeRegistration({ expanded })
  const isCollapsed = useCollapsed()
  return <div data-testid={label}>{String(isCollapsed)}</div>
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
      <button
        onClick={() =>
          setTokens((previous) => ({
            ...previous,
            secondaryPadding: { ...previous.secondaryPadding, baseSize: 500 },
          }))
        }
      >
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
})
