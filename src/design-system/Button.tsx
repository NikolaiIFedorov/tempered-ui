import type { ReactNode } from 'react'
import { useLayer } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { computeSize } from './tokens'

export interface ButtonProps {
  icon?: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}

const PADDING_SCALE = { baseSize: 12, shrinkRatio: 0.85, minSize: 4 }

export function Button({ icon, label, onClick, disabled }: ButtonProps) {
  const layer = useLayer()
  const padding = computeSize(layer, PADDING_SCALE)

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ padding }}>
      <PrimaryContent icon={icon} label={label} />
    </button>
  )
}
