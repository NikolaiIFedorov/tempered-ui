import { useLayoutEffect, useRef, useState } from 'react'
import { useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'
import { useTokens } from './TokensProvider'

export interface ParagraphProps {
  children: string
}

export function Paragraph({ children }: ParagraphProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const tokens = useTokens()
  const fontSize = computeSize(layer, tokens.paragraphFontSize)
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)

  // tokens in deps (not just fontSize) for the same reason as Button/Input
  // — a live Settings edit re-measures correctly, including indirect
  // effects, not just the direct paragraphFontSize case.
  useLayoutEffect(() => {
    if (collapsed || !paragraphRef.current) return
    const rect = paragraphRef.current.getBoundingClientRect()
    const size = direction === 'row' ? rect.width : rect.height
    setExpandedSize((previous) => (previous === size ? previous : size))
  }, [collapsed, children, direction, tokens])

  useMinSizeRegistration(expandedSize === null ? null : { expanded: expandedSize })

  // Paragraph has no background of its own — it sits directly on whatever
  // its enclosing Secondary paints, so its ink matches that same surface.
  const ink = computeInkColor(theme.resolveBase(layer))

  return (
    <p ref={paragraphRef} style={{ fontSize, margin: 0, color: toCssColor(ink) }}>
      <PrimaryContent label={children} />
    </p>
  )
}
