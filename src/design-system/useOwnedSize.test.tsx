import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOwnedSize } from './useOwnedSize'

function Probe({
  defaultSize,
  min,
  enabled,
  axis = 'x' as const,
}: {
  defaultSize: number
  min: number
  enabled: boolean
  axis?: 'x' | 'y'
}) {
  const owned = useOwnedSize<HTMLDivElement>(defaultSize, { axis, min, enabled })
  return (
    <div>
      <div data-testid="target" ref={owned.ref} />
      <div data-testid="size">{owned.size}</div>
      <div data-testid="overridden">{String(owned.isOverridden)}</div>
      {owned.handleProps ? <div data-testid="handle" {...owned.handleProps} /> : null}
    </div>
  )
}

function ProbeWithChangingMin({ defaultSize }: { defaultSize: number }) {
  const [min, setMin] = useState(0)
  const owned = useOwnedSize<HTMLDivElement>(defaultSize, { axis: 'x', min, enabled: true })
  return (
    <div>
      <div data-testid="target" ref={owned.ref} />
      <div data-testid="size">{owned.size}</div>
      <button onClick={() => setMin(300)}>raise floor</button>
      <div data-testid="handle" {...owned.handleProps} />
    </div>
  )
}

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useOwnedSize', () => {
  it('defaults to defaultSize and is not overridden before any drag', () => {
    render(<Probe defaultSize={100} min={0} enabled />)
    expect(screen.getByTestId('size')).toHaveTextContent('100')
    expect(screen.getByTestId('overridden')).toHaveTextContent('false')
  })

  it('exposes no handleProps when disabled', () => {
    render(<Probe defaultSize={100} min={0} enabled={false} />)
    expect(screen.queryByTestId('handle')).not.toBeInTheDocument()
  })

  it('updates size and isOverridden once dragged', () => {
    render(<Probe defaultSize={100} min={0} enabled />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 40, pointerId: 1, buttons: 1 })

    expect(screen.getByTestId('size')).toHaveTextContent('140')
    expect(screen.getByTestId('overridden')).toHaveTextContent('true')
  })

  it("uses the y axis when axis is 'y'", () => {
    render(<Probe defaultSize={100} min={0} enabled axis="y" />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: -30, pointerId: 1, buttons: 1 })

    expect(screen.getByTestId('size')).toHaveTextContent('70')
  })

  it('clamps the dragged size at the floor', () => {
    render(<Probe defaultSize={100} min={20} enabled />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: -100000, pointerId: 1, buttons: 1 })

    expect(screen.getByTestId('size')).toHaveTextContent('20')
  })

  it('re-clamps an existing override upward if the floor later rises above it', () => {
    render(<ProbeWithChangingMin defaultSize={100} />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: -50, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('size')).toHaveTextContent('50')

    fireEvent.click(screen.getByText('raise floor'))
    expect(screen.getByTestId('size')).toHaveTextContent('300')
  })

  it('ignores pointer moves before any pointer down', () => {
    render(<Probe defaultSize={100} min={0} enabled />)
    const handle = screen.getByTestId('handle')
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 })
    expect(screen.getByTestId('size')).toHaveTextContent('100')
    expect(screen.getByTestId('overridden')).toHaveTextContent('false')
  })

  it('stops the drag as soon as a move reveals the button was already released, even with no matching pointerup', () => {
    // A real pointerup can go missing (window blur, a native drag
    // interrupting capture, etc.) — without this, the drag gets stuck: the
    // next pointermove (even a plain hover) would keep resizing.
    render(<Probe defaultSize={100} min={0} enabled />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1, buttons: 1 })
    fireEvent.pointerMove(handle, { clientX: 40, pointerId: 1, buttons: 1 })
    expect(screen.getByTestId('size')).toHaveTextContent('140')

    // No pointerup fired — just a stray move with no button held.
    fireEvent.pointerMove(handle, { clientX: 90, pointerId: 1, buttons: 0 })
    expect(screen.getByTestId('size')).toHaveTextContent('140')

    // Further hover-only movement must not keep resizing.
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1, buttons: 0 })
    expect(screen.getByTestId('size')).toHaveTextContent('140')
  })

  it("stops pointer events from bubbling to an ancestor's own drag handler", () => {
    // A resize handle can end up nested inside an ancestor's own drag
    // surface (e.g. a resizable nested Secondary's handle sits inside the
    // root Secondary's reorderable item wrapper) — without stopPropagation,
    // the ancestor's handler would also see the same gesture and steal
    // pointer capture for itself, breaking the drag.
    const ancestorPointerDown = vi.fn()
    const ancestorPointerMove = vi.fn()

    function Nested() {
      const owned = useOwnedSize<HTMLDivElement>(100, { axis: 'x', min: 0, enabled: true })
      return (
        <div onPointerDown={ancestorPointerDown} onPointerMove={ancestorPointerMove}>
          <div data-testid="target" ref={owned.ref} />
          <div data-testid="size">{owned.size}</div>
          <div data-testid="handle" {...owned.handleProps} />
        </div>
      )
    }

    render(<Nested />)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
    } as DOMRect)

    const handle = screen.getByTestId('handle')
    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 40, pointerId: 1, buttons: 1 })

    expect(ancestorPointerDown).not.toHaveBeenCalled()
    expect(ancestorPointerMove).not.toHaveBeenCalled()
    // The drag itself still works correctly.
    expect(screen.getByTestId('size')).toHaveTextContent('140')
  })
})
