import { fireEvent, render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Input } from './Input'
import { MinSizeRegistryProvider } from './registry'
import { Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'

describe('Input', () => {
  it('shows its label and current value when expanded', () => {
    render(<Input icon={<svg />} label="Width" value="42" onChange={() => {}} />)
    expect(screen.getByText('Width')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
  })

  it('calls onChange with the new value as the user types', () => {
    const onChange = vi.fn()
    render(<Input icon={<svg />} label="Width" value="42" onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('42'), { target: { value: '43' } })
    expect(onChange).toHaveBeenCalledWith('43')
  })

  it('is disabled when disabled is set', () => {
    render(<Input icon={<svg />} label="Width" value="42" onChange={() => {}} disabled />)
    expect(screen.getByDisplayValue('42')).toBeDisabled()
  })
})

describe('Input min-size registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers the prefix width plus the gap plus the field width — not just the prefix alone', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 30,
    } as DOMRect)

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <MinSizeRegistryProvider value={{ register, unregister }}>
        <Input icon={<svg />} label="Width" value="42" onChange={() => {}} />
      </MinSizeRegistryProvider>,
    )

    // At layer 0: gap = 8 (base), fieldWidth = 96 (base) — prefix (30) + gap (8) + field (96) = 134.
    expect(register).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expanded: 134 }),
    )
  })
})

describe('Input inside a Secondary that collapses', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 60,
    } as DOMRect)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('drops the visible label but keeps the value field visible and editable', () => {
    render(
      <Secondary>
        <Input icon={<svg data-testid="icon" />} label="Width" value="42" onChange={() => {}} />
      </Secondary>,
    )

    expect(screen.getByText('Width')).toBeInTheDocument()

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 10, height: 40 })
    })

    expect(screen.queryByText('Width')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).not.toBeDisabled()
  })
})
