import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CollapseProvider } from './layer'
import { Paragraph } from './Paragraph'

describe('Paragraph', () => {
  it('renders its text inside a <p> element when expanded', () => {
    render(<Paragraph>Explains what this panel does.</Paragraph>)
    const paragraph = screen.getByText('Explains what this panel does.')
    expect(paragraph.closest('p')).toBeInTheDocument()
  })

  it('falls back to a title-bearing ellipsis fragment when collapsed, since it has no icon', () => {
    render(
      <CollapseProvider value={true}>
        <Paragraph>Explains what this panel does.</Paragraph>
      </CollapseProvider>,
    )
    expect(screen.getByTitle('Explains what this panel does.')).toBeInTheDocument()
  })
})
