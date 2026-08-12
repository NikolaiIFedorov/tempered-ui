import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKENS, TokensProvider, useSetTokens, useTokens } from './TokensProvider'

function Probe() {
  const tokens = useTokens()
  const setTokens = useSetTokens()
  return (
    <div>
      <div data-testid="base-size">{tokens.buttonPadding.baseSize}</div>
      <button
        onClick={() =>
          setTokens((previous) => ({
            ...previous,
            buttonPadding: { ...previous.buttonPadding, baseSize: 99 },
          }))
        }
      >
        edit
      </button>
    </div>
  )
}

describe('TokensProvider', () => {
  it('defaults to DEFAULT_TOKENS outside a provider, with a no-op setter', () => {
    render(<Probe />)
    expect(screen.getByTestId('base-size')).toHaveTextContent(
      String(DEFAULT_TOKENS.buttonPadding.baseSize),
    )
    // Clicking calls the no-op setter — should not throw, and since there's
    // no real state to update outside a provider, the value stays default.
    fireEvent.click(screen.getByText('edit'))
    expect(screen.getByTestId('base-size')).toHaveTextContent(
      String(DEFAULT_TOKENS.buttonPadding.baseSize),
    )
  })

  it('updates every consumer when setTokens is called inside a provider', () => {
    render(
      <TokensProvider>
        <Probe />
      </TokensProvider>,
    )
    expect(screen.getByTestId('base-size')).toHaveTextContent('12')

    act(() => {
      fireEvent.click(screen.getByText('edit'))
    })

    expect(screen.getByTestId('base-size')).toHaveTextContent('99')
  })
})
