import { fireEvent, render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { CollapseProvider, DirectionProvider } from './layer'
import { MinSizeRegistryProvider, NaturalWidthRegistryProvider } from './registry'
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

  it('carries the shared interaction class and the token-driven motion duration, so hover/press/focus/disabled all animate at the same speed', () => {
    render(<Button label="Save" />)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('ds-interactive')
    expect(button.style.getPropertyValue('--ds-motion-duration')).toBe('150ms')
  })
})

describe('Button width in a column-direction Secondary', () => {
  it('stretches to fill its column (matching the widest sibling) when direction is column', () => {
    render(
      <DirectionProvider value="column">
        <Button label="Save" />
      </DirectionProvider>,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      width: '100%',
      boxSizing: 'border-box',
    })
  })

  it('does not stretch in the default row direction, since its cross axis is height there', () => {
    render(<Button label="Save" />)
    expect(screen.getByRole('button', { name: 'Save' }).style.width).toBe('')
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

describe('Button natural width registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the off-viewport probe's width, not the real (currently collapsed) button's", () => {
    // Distinguishes the hidden probe from the real button by its
    // aria-hidden attribute, the same way a real browser's layout would
    // naturally differ between an unconstrained clone and a collapsed,
    // icon-only button.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.getAttribute('aria-hidden') === 'true' ? 90 : 20
      return { width } as DOMRect
    })

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <CollapseProvider value={true}>
        <NaturalWidthRegistryProvider value={{ register, unregister }}>
          <Button icon={<svg />} label="Save" />
        </NaturalWidthRegistryProvider>
      </CollapseProvider>,
    )

    expect(register).toHaveBeenCalledWith(expect.any(String), 90)
  })

  it("does not clone the caller's own icon element (and its data-testid/key) into the hidden probe", () => {
    render(
      <NaturalWidthRegistryProvider value={{ register: vi.fn(), unregister: vi.fn() }}>
        <Button icon={<svg data-testid="icon" />} label="Save" />
      </NaturalWidthRegistryProvider>,
    )

    expect(screen.getAllByTestId('icon')).toHaveLength(1)
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
      <Secondary
        items={[
          { kind: 'button', props: { icon: <svg data-testid="icon" />, label: 'Save' } },
          { kind: 'button', props: { icon: <svg />, label: 'Cancel' } },
        ]}
      />,
    )

    // Ignores the aria-hidden natural-width probe every Button also
    // renders now (see Button.tsx) — it always shows its label regardless
    // of the real button's collapse state, by design, so a bare text query
    // would otherwise match it too.
    const ignoreProbe = { ignore: '[aria-hidden="true"] *' }
    expect(screen.getByText('Save', ignoreProbe)).toBeInTheDocument()

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 50, height: 40 })
    })

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByText('Save', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
