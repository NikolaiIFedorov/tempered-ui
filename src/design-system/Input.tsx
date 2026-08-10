import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCollapsed, useLayer } from './layer'
import { computeCollapsedContentWidth, PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
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
  const collapsed = useCollapsed()
  const theme = useTheme()
  const fieldWidth = computeSize(layer, FIELD_WIDTH_SCALE)
  const gap = computeSize(layer, GAP_SCALE)
  const padding = computeSize(layer, PADDING_SCALE)
  const prefixRef = useRef<HTMLSpanElement>(null)
  const [expandedPrefixWidth, setExpandedPrefixWidth] = useState<number | null>(null)

  // Measure the prefix wrapper (not just PrimaryContent's inner span) so
  // the label's own gap to the field is captured automatically.
  useLayoutEffect(() => {
    if (collapsed || !prefixRef.current) return
    const width = prefixRef.current.getBoundingClientRect().width
    setExpandedPrefixWidth((previous) => (previous === width ? previous : width))
  }, [collapsed, icon, label])

  const collapsedPrefixWidth = computeCollapsedContentWidth(layer, Boolean(icon))

  // border-box makes the input's real rendered width exactly fieldWidth
  // regardless of its padding/border, so no separate chrome tracking is
  // needed for the field itself — only the value never collapses below it.
  useMinSizeRegistration(
    expandedPrefixWidth === null
      ? null
      : {
          expanded: expandedPrefixWidth + gap + fieldWidth,
          collapsed: collapsedPrefixWidth + gap + fieldWidth,
        },
  )

  // The prefix sits directly on the enclosing Secondary's own background
  // (it has no background of its own), so its ink matches that surface.
  // The field is its own surface, one layer deeper, same as Button.
  const prefixInk = computeInkColor(theme.resolveBase(layer))
  const fieldBackground = theme.resolveBase(layer + 1)
  const fieldInk = computeInkColor(fieldBackground)

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        color: toCssColor(prefixInk),
      }}
    >
      <span ref={prefixRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <PrimaryContent icon={icon} label={label} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: fieldWidth,
          padding,
          boxSizing: 'border-box',
          border: 'none',
          backgroundColor: toCssColor(fieldBackground),
          color: toCssColor(fieldInk),
        }}
      />
    </label>
  )
}
