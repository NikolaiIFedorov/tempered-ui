import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollapsed } from './layer'
import { useMinSizeRegistration } from './registry'
import { Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'

function ChildProbe({
  label,
  expanded,
  collapsed,
}: {
  label: string
  expanded: number
  collapsed: number
}) {
  useMinSizeRegistration({ expanded, collapsed })
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

describe('Secondary collapse', () => {
  it("stays expanded while available space covers the sum of children's expanded min sizes", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <ChildProbe label="b" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <ChildProbe label="b" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <ChildProbe label="b" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <ChildProbe label="b" expanded={50} collapsed={20} />
      </Secondary>,
    )

    expect(screen.getByTestId('a')).toHaveTextContent('false')
    expect(screen.getByTestId('b')).toHaveTextContent('false')
  })

  it('does not render its children when hidden', () => {
    render(
      <Secondary hidden>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    expect(screen.queryByTestId('a')).not.toBeInTheDocument()
  })
})

describe('column-direction root Secondary', () => {
  it('never self-measures — a block element has no genuine external height constraint in ordinary flow', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={9999} collapsed={9999} />
      </Secondary>,
    )

    // No ResizeObserver at all — there is nothing to measure against.
    expect(FakeResizeObserver.instances).toHaveLength(0)
    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })

  it('stays expanded regardless of how large its children register, avoiding the self-referential trap', () => {
    render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={100000} collapsed={50000} />
      </Secondary>,
    )

    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })
})

describe('nested Secondary collapse cascade', () => {
  it("cascades collapse into a nested Secondary's primaries when the ancestor collapses", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
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
        <ChildProbe label="a" expanded={10} collapsed={5} />
        <Secondary>
          <ChildProbe label="nested" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
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
        <ChildProbe label="a" expanded={10} collapsed={5} />
        <Secondary>
          <ChildProbe label="nested" expanded={100} collapsed={40} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
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
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    expect(screen.getByTestId('a').parentElement).toHaveStyle({
      flexShrink: '0',
    })
  })
})

describe('drag-to-resize', () => {
  beforeEach(() => {
    // jsdom doesn't implement pointer capture.
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  // Dragging only updates React state, which changes the wrapper's width
  // style. In a real browser that CSS change makes the real ResizeObserver
  // fire on its own; the fake one needs an explicit trigger to simulate
  // that, same as every other test in this file — so this reads the width
  // the drag actually snapped to and feeds it back in.
  function dragHandleBy(container: HTMLElement, deltaX: number) {
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(handle, { clientX: deltaX, pointerId: 1, buttons: 1 })

    const appliedWidth = parseFloat((container.firstChild as HTMLElement).style.width)
    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: appliedWidth, height: 40 })
    })

    return handle
  }

  it('renders no handle by default (resizable is opt-in)', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('renders a handle on a resizable nested Secondary too', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary resizable>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
        </Secondary>
      </Secondary>,
    )
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('lets a resizable nested Secondary collapse its own primaries via drag, independent of its ancestor', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary resizable>
          <ChildProbe label="nested" expanded={50} collapsed={20} />
        </Secondary>
      </Secondary>,
    )

    const outerObserver = FakeResizeObserver.instances[0]
    act(() => {
      outerObserver.trigger({ width: 300, height: 40 })
    })
    expect(screen.getByTestId('a')).toHaveTextContent('false')

    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1, buttons: 1 })
    // A large drag toward zero comfortably crosses the midpoint between
    // the nested Secondary's expanded and collapsed footprints.
    fireEvent.pointerMove(handle, { clientX: -1000, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(screen.getByTestId('nested')).toHaveTextContent('true')
    // Only the nested Secondary's own primary collapsed — the ancestor's
    // sibling primary is unaffected.
    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })

  it('still cascades ancestor collapse into a nested Secondary even if its own drag says it has enough room', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary resizable>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
        </Secondary>
      </Secondary>,
    )

    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(handle, { pointerId: 1 })

    const outerObserver = FakeResizeObserver.instances[0]
    act(() => {
      outerObserver.trigger({ width: 40, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('nested')).toHaveTextContent('true')
  })

  it('renders a handle on a resizable root Secondary', () => {
    render(
      <Secondary resizable>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('collapses children when dragged past the midpoint, through the same pipeline a viewport resize uses, and snaps to the exact collapsed width', () => {
    const { container } = render(
      <Secondary resizable>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <ChildProbe label="b" expanded={50} collapsed={20} />
      </Secondary>,
    )

    dragHandleBy(container, -1000)

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('b')).toHaveTextContent('true')
    // Snaps exactly to the collapsed footprint (20+20 children, 16 gap,
    // 24 padding, 6 handle) — never an arbitrary in-between width the way
    // a continuous resize would.
    expect((container.firstChild as HTMLElement).style.width).toBe('86px')
  })

  it('ignores a small drag that stays on the same side of the midpoint', () => {
    const { container } = render(
      <Secondary resizable>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    dragHandleBy(container, -1)

    expect(screen.getByTestId('a')).toHaveTextContent('false')
  })

  it('expands again when dragged back out past the midpoint', () => {
    const { container } = render(
      <Secondary resizable>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    // First shrink it enough to collapse...
    dragHandleBy(container, -1000)
    expect(screen.getByTestId('a')).toHaveTextContent('true')

    // ...then drag back out past the midpoint again.
    dragHandleBy(container, 1000)
    expect(screen.getByTestId('a')).toHaveTextContent('false')
    // Deferring back to '100%' (real measured space) is deliberate, not
    // an exact requiredExpanded pixel value: the root re-derives its own
    // collapse by comparing ResizeObserver's measured width against that
    // same threshold, and forcing an exact match is a knife's edge — real
    // subpixel rounding can read the measured width back as a hair under
    // the threshold and immediately re-collapse it.
    expect((container.firstChild as HTMLElement).style.width).toBe('100%')
  })

  it('stops the drag as soon as a move reveals the button was already released, even with no matching pointerup', () => {
    const { container } = render(
      <Secondary resizable>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )
    const observer = FakeResizeObserver.instances[0]
    const applyWidth = () =>
      act(() => {
        observer.trigger({
          width: parseFloat((container.firstChild as HTMLElement).style.width),
          height: 40,
        })
      })

    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(handle, { clientX: -1000, pointerId: 1, buttons: 1 })
    applyWidth()
    expect(screen.getByTestId('a')).toHaveTextContent('true')

    // No pointerup fired — just a stray move with no button held.
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1, buttons: 0 })
    // Since the drag session ended there, a further move (with no matching
    // pointerdown reopening it) must be a no-op rather than reviving it.
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1, buttons: 1 })
    applyWidth()
    expect(screen.getByTestId('a')).toHaveTextContent('true')
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
        <ChildProbe key="c" label="c" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
        <ChildProbe key="c" label="c" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
        <ChildProbe key="c" label="c" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
        <ChildProbe key="c" label="c" expanded={10} collapsed={5} />
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
        <ChildProbe key="a" label="a" expanded={10} collapsed={5} />
        <ChildProbe key="b" label="b" expanded={10} collapsed={5} />
        <ChildProbe key="c" label="c" expanded={10} collapsed={5} />
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
