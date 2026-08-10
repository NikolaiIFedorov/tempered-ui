import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollapseProvider } from './layer'
import { MinSizeRegistryProvider } from './registry'
import { PrimaryContent } from './PrimaryContent'

describe('PrimaryContent rendering', () => {
  it('shows icon and label when expanded', () => {
    render(<PrimaryContent icon={<svg data-testid="icon" />} label="Save" />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('shows only the icon when collapsed', () => {
    render(
      <CollapseProvider value={true}>
        <PrimaryContent icon={<svg data-testid="icon" />} label="Save" />
      </CollapseProvider>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('falls back to a title-bearing ellipsis fragment when collapsed with no icon', () => {
    render(
      <CollapseProvider value={true}>
        <PrimaryContent label="Long paragraph text" />
      </CollapseProvider>,
    )
    expect(screen.getByTitle('Long paragraph text')).toBeInTheDocument()
  })
})

describe('PrimaryContent min-size registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers its measured expanded width and icon-based collapsed width', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 123,
    } as DOMRect)

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <MinSizeRegistryProvider value={{ register, unregister }}>
        <PrimaryContent icon={<svg />} label="Save" />
      </MinSizeRegistryProvider>,
    )

    expect(register).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expanded: 123 }),
    )
  })
})
