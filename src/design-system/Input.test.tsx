import { fireEvent, render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Input } from './Input'
import { CollapseProvider, DirectionProvider } from './layer'
import { MinSizeRegistryProvider, NaturalWidthRegistryProvider } from './registry'
import { Secondary } from './Secondary'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'

describe('Input', () => {
  it('shows its label and current value when expanded', () => {
    render(<Input icon={<svg />} label="Width" value="42" onChange={() => {}} />)
    // Ignores the aria-hidden natural-width probe every Input also renders
    // now (see Input.tsx) — it always shows its label, by design, so a
    // bare text query would otherwise match it too.
    expect(screen.getByText('Width', { ignore: '[aria-hidden="true"] *' })).toBeInTheDocument()
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

describe('Input width in a column-direction Secondary', () => {
  it('stretches the field (not the label) to fill its column when direction is column', () => {
    render(
      <DirectionProvider value="column">
        <Input icon={<svg />} label="Width" value="42" onChange={() => {}} />
      </DirectionProvider>,
    )
    const label = screen.getByDisplayValue('42').closest('label')!
    expect(label).toHaveStyle({ width: '100%' })
    expect(screen.getByDisplayValue('42')).toHaveStyle({ flexGrow: '1' })
  })

  it('does not stretch in the default row direction, since its cross axis is height there', () => {
    render(<Input icon={<svg />} label="Width" value="42" onChange={() => {}} />)
    const label = screen.getByDisplayValue('42').closest('label')!
    expect(label.style.width).toBe('')
    expect(screen.getByDisplayValue('42').style.flexGrow).toBe('')
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

describe('Input natural width registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the off-viewport probe's prefix width, not the real (currently collapsed) prefix's", () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.getAttribute('aria-hidden') === 'true' ? 50 : 5
      return { width } as DOMRect
    })

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <CollapseProvider value={true}>
        <NaturalWidthRegistryProvider value={{ register, unregister }}>
          <Input icon={<svg />} label="Width" value="42" onChange={() => {}} />
        </NaturalWidthRegistryProvider>
      </CollapseProvider>,
    )

    // gap = 8 (base), fieldWidth = 96 (base) — probe prefix (50) + gap (8) + field (96) = 154.
    expect(register).toHaveBeenCalledWith(expect.any(String), 154)
  })

  it("does not clone the caller's own icon element (and its data-testid/key) into the hidden probe", () => {
    render(
      <NaturalWidthRegistryProvider value={{ register: vi.fn(), unregister: vi.fn() }}>
        <Input icon={<svg data-testid="icon" />} label="Width" value="42" onChange={() => {}} />
      </NaturalWidthRegistryProvider>,
    )

    expect(screen.getAllByTestId('icon')).toHaveLength(1)
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
      <Secondary
        items={[
          {
            kind: 'input',
            props: { icon: <svg data-testid="icon" />, label: 'Width', value: '42', onChange: () => {} },
          },
        ]}
      />,
    )

    const ignoreProbe = { ignore: '[aria-hidden="true"] *' }
    expect(screen.getByText('Width', ignoreProbe)).toBeInTheDocument()

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 10, height: 40 })
    })

    expect(screen.queryByText('Width', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).not.toBeDisabled()
  })
})
