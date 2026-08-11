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
