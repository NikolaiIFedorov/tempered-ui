import { useLayer } from './layer'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'
import { useTokens } from './TokensProvider'

export interface ParagraphProps {
  children: string
}

// Unlike Button/Input, Paragraph never switches to a discrete collapsed
// form — collapsing exists to reclaim space some Primary genuinely needs
// (an icon fallback, a narrower field), but Paragraph has no icon to fall
// back to and no hard minimum it's protecting; ordinary text wrapping
// already lets it use however much width it's given. Participating in the
// same collapse cascade as its siblings would truncate it to a near-
// unreadable fragment even when its own text has plenty of room — it just
// isn't the same kind of "this doesn't fit" problem collapse solves.
export function Paragraph({ children }: ParagraphProps) {
  const layer = useLayer()
  const theme = useTheme()
  const tokens = useTokens()
  const fontSize = computeSize(layer, tokens.paragraphFontSize)

  // Paragraph has no background of its own — it sits directly on whatever
  // its enclosing Secondary paints, so its ink matches that same surface.
  const ink = computeInkColor(theme.resolveBase(layer))

  return <p style={{ fontSize, margin: 0, color: toCssColor(ink), minWidth: 0 }}>{children}</p>
}
