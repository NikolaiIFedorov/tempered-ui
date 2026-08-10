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
})
