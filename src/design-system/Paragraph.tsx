import { useLayer } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { computeSize } from './tokens'

export interface ParagraphProps {
  children: string
}

const FONT_SIZE_SCALE = { baseSize: 14, shrinkRatio: 0.9, minSize: 10 }

export function Paragraph({ children }: ParagraphProps) {
  const layer = useLayer()
  const fontSize = computeSize(layer, FONT_SIZE_SCALE)

  return (
    <p style={{ fontSize, margin: 0 }}>
      <PrimaryContent label={children} />
    </p>
  )
}
