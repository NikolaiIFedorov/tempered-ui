import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollapseProvider } from './layer'
import { MinSizeRegistryProvider } from './registry'
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

describe('Paragraph min-size registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers the real <p> element width so it counts toward its Secondary collapse threshold', () => {
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

    expect(register).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expanded: 200 }),
    )
  })
})
