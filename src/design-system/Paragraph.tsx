import { useLayoutEffect, useRef, useState } from 'react'
import { useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { computeCollapsedContentWidth, PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'

export interface ParagraphProps {
  children: string
}

const FONT_SIZE_SCALE = { baseSize: 14, shrinkRatio: 0.9, minSize: 10 }

export function Paragraph({ children }: ParagraphProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const fontSize = computeSize(layer, FONT_SIZE_SCALE)
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (collapsed || !paragraphRef.current) return
    const rect = paragraphRef.current.getBoundingClientRect()
    const size = direction === 'row' ? rect.width : rect.height
    setExpandedSize((previous) => (previous === size ? previous : size))
  }, [collapsed, children, direction])

  // Collapsing only ever hides text horizontally — it never changes how
  // tall a single line of text is — so along the column/height axis the
  // collapsed footprint is just the same measured size as expanded.
  const collapsedSize =
    direction === 'row' ? computeCollapsedContentWidth(layer, false) : (expandedSize ?? 0)

  useMinSizeRegistration(
    expandedSize === null ? null : { expanded: expandedSize, collapsed: collapsedSize },
  )

  // Paragraph has no background of its own — it sits directly on whatever
  // its enclosing Secondary paints, so its ink matches that same surface.
  const ink = computeInkColor(theme.resolveBase(layer))

  return (
    <p ref={paragraphRef} style={{ fontSize, margin: 0, color: toCssColor(ink) }}>
      <PrimaryContent label={children} />
    </p>
  )
}
