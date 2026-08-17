import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// Secondary, Button, and Input padding/radius turned out to be either
// identical or a fixed ratio of each other — one shared `padding` instead
// of a copy per component. Radius settled at ratio 1 (radius = padding
// exactly), so radiusRatio isn't its own token either anymore — every
// component that has padding just uses that same value as its
// borderRadius directly. Secondary's inter-item gap, Input's
// label-to-field gap, Input's own internal field padding, and
// PrimaryContent's icon-to-label gap all step from that same `padding`
// value too (Secondary's gap at ratio 1, the other three at ratio 0.5)
// rather than carrying their own tokens — no equation demanded any of
// these divergences. Input's field width and PrimaryContent's collapsed
// ellipsis width aren't tokens at all anymore — see FIELD_WIDTH_TEMPLATE in
// Input.tsx and ELLIPSIS_WIDTH in PrimaryContent.tsx. `fontSize` is a
// genuinely different physical quantity from a spacing value, so it never
// merges into `padding` — but it isn't Paragraph's alone either: it's set
// once, ambiently, on the app root (see AppContent in App.tsx) and
// inherited from there by every component's text, Paragraph included (an
// explicit `font: inherit` reset on form controls in index.css makes
// Button/Input's <button>/<input> pick it up too, since those don't
// inherit font styles by default). PrimaryContent's icon (1em) rides on
// whatever this resolves to in context, same as everything else. `motionDuration`
// is a "how snappy" dial, the same character as padding/fontSize — but its
// easing curve isn't: nothing needs a *tuned* curve the way duration needs a
// tuned speed, so that's a fixed constant (MOTION_EASING in motion.ts)
// instead of a second token.
export interface DesignTokens {
  padding: number
  fontSize: number
  motionDuration: number
}

export const DEFAULT_TOKENS: DesignTokens = {
  padding: 12,
  fontSize: 14,
  motionDuration: 150,
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
