import { act, render, screen } from '@testing-library/react'
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
