import { useLayoutEffect, useRef, useState } from 'react'
import { useCollapsed, useLayer } from './layer'
import { computeCollapsedContentWidth, PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeSize } from './tokens'

export interface ParagraphProps {
  children: string
}

const FONT_SIZE_SCALE = { baseSize: 14, shrinkRatio: 0.9, minSize: 10 }

export function Paragraph({ children }: ParagraphProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const fontSize = computeSize(layer, FONT_SIZE_SCALE)
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  const [expandedWidth, setExpandedWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (collapsed || !paragraphRef.current) return
    const width = paragraphRef.current.getBoundingClientRect().width
    setExpandedWidth((previous) => (previous === width ? previous : width))
  }, [collapsed, children])

  const collapsedWidth = computeCollapsedContentWidth(layer, false)

  useMinSizeRegistration(
    expandedWidth === null ? null : { expanded: expandedWidth, collapsed: collapsedWidth },
  )

  return (
    <p ref={paragraphRef} style={{ fontSize, margin: 0 }}>
      <PrimaryContent label={children} />
    </p>
  )
}
