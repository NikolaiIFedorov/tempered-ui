import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SizeScale } from './tokens'

// One size token per component-owned scale — the single source every
// component reads from instead of its own hardcoded module-level const,
// and the single source Settings reads/writes instead of keeping its own
// separate copy of the same numbers.
export interface DesignTokens {
  secondaryGap: SizeScale
  secondaryPadding: SizeScale
  secondaryRadiusRatio: number
  buttonPadding: SizeScale
  buttonRadiusRatio: number
  inputFieldWidth: SizeScale
  inputGap: SizeScale
  inputPadding: SizeScale
  inputRadiusRatio: number
  paragraphFontSize: SizeScale
  primaryContentGap: SizeScale
  primaryContentEllipsisWidth: number
}

export const DEFAULT_TOKENS: DesignTokens = {
  secondaryGap: { baseSize: 8, shrinkRatio: 0.85, minSize: 2 },
  secondaryPadding: { baseSize: 12, shrinkRatio: 0.6, minSize: 4 },
  secondaryRadiusRatio: 0.5,
  buttonPadding: { baseSize: 12, shrinkRatio: 0.6, minSize: 4 },
  buttonRadiusRatio: 0.5,
  inputFieldWidth: { baseSize: 96, shrinkRatio: 0.85, minSize: 48 },
  inputGap: { baseSize: 8, shrinkRatio: 0.85, minSize: 4 },
  inputPadding: { baseSize: 6, shrinkRatio: 0.6, minSize: 2 },
  inputRadiusRatio: 0.5,
  paragraphFontSize: { baseSize: 14, shrinkRatio: 0.9, minSize: 10 },
  primaryContentGap: { baseSize: 6, shrinkRatio: 0.85, minSize: 2 },
  primaryContentEllipsisWidth: 24,
}

export interface TokensContextValue {
  tokens: DesignTokens
  setTokens: (updater: (previous: DesignTokens) => DesignTokens) => void
}

// Defaults to real, editable-shaped values (not throwing) outside a
// provider, consistent with every other design-system hook — the setter
// is just a no-op there, since there's no state to update.
const TokensContext = createContext<TokensContextValue>({
  tokens: DEFAULT_TOKENS,
  setTokens: () => {},
})

export function TokensProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_TOKENS)
  const value = useMemo(() => ({ tokens, setTokens }), [tokens])
  return <TokensContext.Provider value={value}>{children}</TokensContext.Provider>
}

export function useTokens(): DesignTokens {
  return useContext(TokensContext).tokens
}

export function useSetTokens(): TokensContextValue['setTokens'] {
  return useContext(TokensContext).setTokens
}
