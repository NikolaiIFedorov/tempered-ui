import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCollapsed, useLayer, useSecondaryDirection } from './layer'
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
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const fieldWidth = computeSize(layer, FIELD_WIDTH_SCALE)
  const gap = computeSize(layer, GAP_SCALE)
  const padding = computeSize(layer, PADDING_SCALE)
  const prefixRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (collapsed) return
    if (direction === 'row') {
      // Measure the prefix wrapper (not just PrimaryContent's inner span)
      // so the label's own gap to the field is captured automatically —
      // the field's own width is added analytically below since it's
      // fixed regardless of measurement.
      if (!prefixRef.current) return
      const width = prefixRef.current.getBoundingClientRect().width
      setExpandedSize((previous) => (previous === width ? previous : width))
    } else {
      // Input's internal layout (prefix beside field) is always row,
      // regardless of the enclosing Secondary's direction, so height isn't
      // decomposable the way width is — measure the whole element instead.
      if (!labelRef.current) return
      const height = labelRef.current.getBoundingClientRect().height
      setExpandedSize((previous) => (previous === height ? previous : height))
    }
  }, [collapsed, icon, label, direction])

  // Collapsing only ever hides the prefix label horizontally — it never
  // changes Input's height — so along the column/height axis the collapsed
  // footprint is just the same measured size as expanded.
  const collapsedSize =
    direction === 'row'
      ? computeCollapsedContentWidth(layer, Boolean(icon)) + gap + fieldWidth
      : (expandedSize ?? 0)

  // border-box makes the input's real rendered width exactly fieldWidth
  // regardless of its padding/border, so no separate chrome tracking is
  // needed for the field itself — only the value never collapses below it.
  useMinSizeRegistration(
    expandedSize === null
      ? null
      : {
          expanded: direction === 'row' ? expandedSize + gap + fieldWidth : expandedSize,
          collapsed: collapsedSize,
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
      ref={labelRef}
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
