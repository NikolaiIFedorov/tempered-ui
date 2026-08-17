import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollapseProvider } from './layer'
import { MinSizeRegistryProvider, NaturalWidthRegistryProvider } from './registry'
import { Secondary } from './Secondary'
import { Selector } from './Selector'
import { FakeResizeObserver } from './test-utils/fakeResizeObserver'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: <svg data-testid="light-icon" /> },
  { value: 'dark', label: 'Dark', icon: <svg data-testid="dark-icon" /> },
  { value: 'auto', label: 'OS', icon: <svg data-testid="auto-icon" /> },
]

describe('Selector', () => {
  it('shows every option as a button, but only the selected one shows its label', () => {
    render(<Selector options={OPTIONS} value="dark" onChange={() => {}} />)

    const ignoreProbe = { ignore: '[aria-hidden="true"] *' }
    expect(screen.getByText('Dark', ignoreProbe)).toBeInTheDocument()
    expect(screen.queryByText('Light', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.queryByText('OS', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('calls onChange with the clicked option\'s value, even one shown icon-only', () => {
    const onChange = vi.fn()
    render(<Selector options={OPTIONS} value="dark" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(onChange).toHaveBeenCalledWith('light')
  })

  it('is disabled when disabled is set', () => {
    render(<Selector options={OPTIONS} value="dark" onChange={() => {}} disabled />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('renders no caption at all when label is omitted', () => {
    render(<Selector options={OPTIONS} value="dark" onChange={() => {}} />)
    // Only the 3 option buttons — nothing else labeled the group.
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('carries the shared interaction class and the token-driven motion duration on every option', () => {
    render(<Selector options={OPTIONS} value="dark" onChange={() => {}} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('ds-interactive')
      expect(button.style.getPropertyValue('--ds-motion-duration')).toBe('150ms')
    }
  })

  it('shows the given label as a caption alongside the options', () => {
    render(<Selector label="Theme mode" options={OPTIONS} value="dark" onChange={() => {}} />)
    expect(screen.getByText('Theme mode', { ignore: '[aria-hidden="true"] *' })).toBeInTheDocument()
  })

  it('gives the selected option a different background than the others', () => {
    render(<Selector options={OPTIONS} value="dark" onChange={() => {}} />)

    const ignoreProbe = { ignore: '[aria-hidden="true"] *' }
    const selectedButton = screen.getByText('Dark', ignoreProbe).closest('button')!
    const unselectedButton = screen.getByRole('button', { name: 'Light' })

    expect(selectedButton.style.backgroundColor).not.toBe('')
    expect(unselectedButton.style.backgroundColor).not.toBe('')
    expect(selectedButton.style.backgroundColor).not.toBe(unselectedButton.style.backgroundColor)
  })
})

describe('Selector min-size registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the real row element's width — not a per-option sum computed separately", () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 130,
    } as DOMRect)

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <MinSizeRegistryProvider value={{ register, unregister }}>
        <Selector options={OPTIONS} value="dark" onChange={() => {}} />
      </MinSizeRegistryProvider>,
    )

    expect(register).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expanded: 130 }),
    )
  })
})

describe('Selector natural width registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the off-viewport probe's width, not the real (currently collapsed) row's", () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.getAttribute('aria-hidden') === 'true' ? 140 : 40
      return { width } as DOMRect
    })

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <CollapseProvider value={true}>
        <NaturalWidthRegistryProvider value={{ register, unregister }}>
          <Selector options={OPTIONS} value="dark" onChange={() => {}} />
        </NaturalWidthRegistryProvider>
      </CollapseProvider>,
    )

    expect(register).toHaveBeenCalledWith(expect.any(String), 140)
  })

  it("does not clone the caller's own icon elements (and their data-testid/key) into the hidden probes", () => {
    render(
      <NaturalWidthRegistryProvider value={{ register: vi.fn(), unregister: vi.fn() }}>
        <Selector options={OPTIONS} value="dark" onChange={() => {}} />
      </NaturalWidthRegistryProvider>,
    )

    expect(screen.getAllByTestId('dark-icon')).toHaveLength(1)
  })
})

describe('Selector inside a Secondary that collapses', () => {
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

  it('drops the selected option\'s label too once the ambient Secondary collapses — selection is a second, independent reason to collapse, not an exemption from the first', () => {
    render(
      <Secondary
        items={[{ kind: 'selector', props: { options: OPTIONS, value: 'dark', onChange: () => {} } }]}
      />,
    )

    const ignoreProbe = { ignore: '[aria-hidden="true"] *' }
    expect(screen.getByText('Dark', ignoreProbe)).toBeInTheDocument()

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 20, height: 40 })
    })

    expect(screen.queryByText('Dark', ignoreProbe)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('truncates the label caption to its ellipsis fallback once the ambient Secondary collapses', () => {
    render(
      <Secondary
        items={[
          {
            kind: 'selector',
            props: { label: 'Theme mode', options: OPTIONS, value: 'dark', onChange: () => {} },
          },
        ]}
      />,
    )

    // The ellipsis fallback (PrimaryContent, no icon) is the only place
    // that puts a title attribute on the label — present only once it's
    // actually the collapsed rendering, not the expanded one. getByTitle
    // doesn't support the `ignore` option getByText does, so the aria-hidden
    // probes (which always include a forced-collapsed clone) are filtered
    // out by hand instead.
    const liveTitledLabels = () =>
      screen.queryAllByTitle('Theme mode').filter((el) => !el.closest('[aria-hidden="true"]'))

    expect(liveTitledLabels()).toHaveLength(0)

    const observer = FakeResizeObserver.instances[0]
    act(() => {
      observer.trigger({ width: 20, height: 40 })
    })

    expect(liveTitledLabels()).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })
})
