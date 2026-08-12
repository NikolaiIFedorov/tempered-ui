import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'
import { useTokens } from './TokensProvider'

export interface InputProps {
  icon?: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function Input({ icon, label, value, onChange, placeholder, disabled }: InputProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const tokens = useTokens()
  const {
    inputFieldWidth: FIELD_WIDTH_SCALE,
    inputGap: GAP_SCALE,
    inputPadding: PADDING_SCALE,
    inputRadiusRatio: RADIUS_RATIO,
  } = tokens
  const gap = computeSize(layer, GAP_SCALE)
  const padding = computeSize(layer, PADDING_SCALE)
  const prefixRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)

  const fieldWidth = computeSize(layer, FIELD_WIDTH_SCALE)

  // tokens (the whole object) is in deps, not just the specific scales
  // used directly here, so a live Settings edit re-measures and
  // re-registers correctly even for indirect effects (e.g. PrimaryContent's
  // own gap token changing the prefix's rendered width) — see Button for
  // the same reasoning.
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
  }, [collapsed, icon, label, direction, tokens])

  // border-box makes the input's real rendered width exactly fieldWidth
  // regardless of its padding/border, so no separate chrome tracking is
  // needed for the field itself.
  useMinSizeRegistration(
    expandedSize === null
      ? null
      : { expanded: direction === 'row' ? expandedSize + gap + fieldWidth : expandedSize },
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
        // See Button for why this is needed at all: a column-direction
        // Secondary's items stretch to the widest sibling by default
        // (align-items: stretch), but an inline-flex box won't fill that
        // stretched space on its own.
        width: direction === 'column' ? '100%' : undefined,
      }}
    >
      <span ref={prefixRef} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
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
          // fieldWidth is the floor (and the row-direction, non-stretched
          // size) — flexGrow lets the field itself be "the part that gets
          // wider" when there's extra room, rather than the label growing
          // or a gap opening up between label and field.
          flexGrow: direction === 'column' ? 1 : undefined,
          padding,
          borderRadius: padding * RADIUS_RATIO,
          boxSizing: 'border-box',
          border: 'none',
          backgroundColor: toCssColor(fieldBackground),
          color: toCssColor(fieldInk),
        }}
      />
    </label>
  )
}
