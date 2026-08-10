import type { ReactNode } from 'react'
import { useCollapsed, useLayer } from './layer'
import { computeSize } from './tokens'

export interface PrimaryContentProps {
  icon?: ReactNode
  label: string
}

const ICON_SCALE = { baseSize: 20, shrinkRatio: 0.85, minSize: 12 }
const GAP_SCALE = { baseSize: 6, shrinkRatio: 0.85, minSize: 2 }
const ELLIPSIS_WIDTH = 24

// The content-only width PrimaryContent would render at while collapsed —
// icon size if there's an icon, otherwise the fixed ellipsis-fragment
// width. A concrete Primary (Button, Input, Paragraph) that owns its own
// outer chrome (padding, borders) adds this to that chrome to register its
// true collapsed footprint, since PrimaryContent itself doesn't know about
// chrome it doesn't render.
export function computeCollapsedContentWidth(layer: number, hasIcon: boolean): number {
  return hasIcon ? computeSize(layer, ICON_SCALE) : ELLIPSIS_WIDTH
}

export function PrimaryContent({ icon, label }: PrimaryContentProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const iconSize = computeSize(layer, ICON_SCALE)

  if (collapsed) {
    if (icon) {
      return (
        <span title={label} aria-label={label} style={{ width: iconSize, height: iconSize }}>
          {icon}
        </span>
      )
    }
    return (
      <span
        title={label}
        style={{
          display: 'inline-block',
          width: ELLIPSIS_WIDTH,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: computeSize(layer, GAP_SCALE),
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}
