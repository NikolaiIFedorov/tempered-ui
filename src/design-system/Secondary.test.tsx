import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollapsed } from './layer'
import { useMinSizeRegistration } from './registry'
import { Secondary } from './Secondary'

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger(size: { width: number; height: number }) {
    this.callback([{ contentRect: size } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

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
