import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CollapseProvider } from './layer'
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

  // Regression: a plain (default display: inline) span ignores width/height
  // entirely, so 1em sizing would silently do nothing and leave the icon's
  // own width: 100% (from the .primary-icon > svg CSS rule) with no real
  // box to resolve against — this hit live as a giant, wrongly-scaled icon
  // in collapsed mode specifically, where this wrapper is the outermost
  // element (not a flex item getting blockified for free).
  it('gives the icon wrapper an explicit box (not inline) so 1em sizing actually applies, in both collapsed and expanded rendering', () => {
    const { unmount } = render(<PrimaryContent icon={<svg data-testid="icon" />} label="Save" />)
    const expandedWrapper = screen.getByTestId('icon').parentElement!
    expect(expandedWrapper).toHaveClass('primary-icon')
    expect(expandedWrapper).toHaveStyle({ display: 'inline-block', width: '1em', height: '1em' })
    unmount()

    render(
      <CollapseProvider value={true}>
        <PrimaryContent icon={<svg data-testid="icon" />} label="Save" />
      </CollapseProvider>,
    )
    const collapsedWrapper = screen.getByTestId('icon').parentElement!
    expect(collapsedWrapper).toHaveClass('primary-icon')
    expect(collapsedWrapper).toHaveStyle({ display: 'inline-block', width: '1em', height: '1em' })
  })
})
