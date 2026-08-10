import { fireEvent, render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { MinSizeRegistryProvider } from './registry'
import { Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'

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

describe('Button min-size registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the real <button> element's width, including its own padding — not just its inner content", () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 84,
    } as DOMRect)

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <MinSizeRegistryProvider value={{ register, unregister }}>
        <Button icon={<svg />} label="Save" />
      </MinSizeRegistryProvider>,
    )

    expect(register).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expanded: 84 }),
    )
  })
})

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
