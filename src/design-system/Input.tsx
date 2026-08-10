import type { ReactNode } from 'react'
import { useLayer } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeSize } from './tokens'

export interface InputProps {
  icon?: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

const FIELD_WIDTH_SCALE = { baseSize: 96, shrinkRatio: 0.85, minSize: 48 }
const GAP_SCALE = { baseSize: 8, shrinkRatio: 0.85, minSize: 4 }
const PADDING_SCALE = { baseSize: 6, shrinkRatio: 0.85, minSize: 2 }

export function Input({ icon, label, value, onChange, placeholder, disabled }: InputProps) {
  const layer = useLayer()
  const fieldWidth = computeSize(layer, FIELD_WIDTH_SCALE)
  const padding = computeSize(layer, PADDING_SCALE)

  useMinSizeRegistration({ expanded: fieldWidth, collapsed: fieldWidth })

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: computeSize(layer, GAP_SCALE),
      }}
    >
      <PrimaryContent icon={icon} label={label} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: fieldWidth, padding }}
      />
    </label>
  )
}
