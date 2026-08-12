import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CollapseProvider } from './layer'
import { MinSizeRegistryProvider } from './registry'
import { Paragraph } from './Paragraph'

describe('Paragraph', () => {
  it('renders its text inside a <p> element', () => {
    render(<Paragraph>Explains what this panel does.</Paragraph>)
    const paragraph = screen.getByText('Explains what this panel does.')
    expect(paragraph.closest('p')).toBeInTheDocument()
  })

  // Unlike Button/Input, Paragraph never switches to a discrete collapsed
  // form — it has no icon to fall back to, and ordinary text wrapping
  // already lets it use however much width it's given, so it doesn't need
  // the same "not enough room" escape hatch collapse exists for.
  it('keeps rendering its full text even when its ancestor Secondary is collapsed', () => {
    render(
      <CollapseProvider value={true}>
        <Paragraph>Explains what this panel does.</Paragraph>
      </CollapseProvider>,
    )
    expect(screen.getByText('Explains what this panel does.')).toBeInTheDocument()
  })
})

describe('Paragraph does not participate in min-size registration', () => {
  it('never registers, since it has no discrete collapsed form for a collapse threshold to protect', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
    } as DOMRect)

    const register = vi.fn()
    const unregister = vi.fn()

    render(
      <MinSizeRegistryProvider value={{ register, unregister }}>
        <Paragraph>Explains what this panel does.</Paragraph>
      </MinSizeRegistryProvider>,
    )

    expect(register).not.toHaveBeenCalled()
  })
})
