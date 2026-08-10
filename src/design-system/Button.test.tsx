import { fireEvent, render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Secondary } from './Secondary'

describe('Button', () => {
  it('renders as a button with the label as its accessible name', () => {
    render(<Button label="Save" />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button label="Save" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled is set', () => {
    render(<Button label="Save" disabled />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

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

describe('Button inside a Secondary that collapses', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 120,
    } as DOMRect)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stays labeled but drops visible text once the Secondary collapses it', () => {
    render(
      <Secondary>
        <Button icon={<svg data-testid="icon" />} label="Save" />
        <Button icon={<svg />} label="Cancel" />
      </Secondary>,
    )

    expect(screen.getByText('Save')).toBeInTheDocument()

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 50, height: 40 })
    })

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
