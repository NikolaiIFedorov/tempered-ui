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
  it("cascades collapse into a nested Secondary's primaries even when the nested Secondary has plenty of its own space", () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
        </Secondary>
      </Secondary>,
    )

    // Effects run children-first, so the nested Secondary's observer is created before the outer's.
    const [nestedObserver, outerObserver] = FakeResizeObserver.instances

    act(() => {
      nestedObserver.trigger({ width: 200, height: 40 })
      outerObserver.trigger({ width: 40, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('true')
    expect(screen.getByTestId('nested')).toHaveTextContent('true')
  })

  it('still collapses a nested Secondary on its own when only its own space is insufficient', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={10} collapsed={5} />
        <Secondary>
          <ChildProbe label="nested" expanded={50} collapsed={20} />
        </Secondary>
      </Secondary>,
    )

    const [nestedObserver, outerObserver] = FakeResizeObserver.instances

    act(() => {
      outerObserver.trigger({ width: 200, height: 40 })
      nestedObserver.trigger({ width: 30, height: 40 })
    })

    expect(screen.getByTestId('a')).toHaveTextContent('false')
    expect(screen.getByTestId('nested')).toHaveTextContent('true')
  })

  it('expands the nested Secondary again once both it and its ancestor recover space', () => {
    render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
        <Secondary>
          <ChildProbe label="nested" expanded={30} collapsed={10} />
        </Secondary>
      </Secondary>,
    )

    const [nestedObserver, outerObserver] = FakeResizeObserver.instances

    act(() => {
      nestedObserver.trigger({ width: 200, height: 40 })
      outerObserver.trigger({ width: 40, height: 40 })
    })
    expect(screen.getByTestId('nested')).toHaveTextContent('true')

    act(() => {
      outerObserver.trigger({ width: 200, height: 40 })
    })
    expect(screen.getByTestId('nested')).toHaveTextContent('false')
  })
})

describe('Secondary overflow (scroll fallback for when even collapsed children do not fit)', () => {
  it('scrolls along the row axis and clips the cross axis by default', () => {
    const { container } = render(
      <Secondary>
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    expect(container.firstChild).toHaveStyle({
      overflowX: 'auto',
      overflowY: 'hidden',
    })
  })

  it('scrolls along the column axis and clips the cross axis when direction is column', () => {
    const { container } = render(
      <Secondary direction="column">
        <ChildProbe label="a" expanded={50} collapsed={20} />
      </Secondary>,
    )

    expect(container.firstChild).toHaveStyle({
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
