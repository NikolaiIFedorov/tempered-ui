import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CollapseProvider, useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration, useNaturalWidthRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { useTokens } from './TokensProvider'

// Placeholder for the CAD kernel's real numeric tolerance (assembly/kernel),
// not yet exposed over wasm — 3 decimal places, sign, and a 3-digit integer
// part budget is a guess at the shape, not a derived value. Swap this for
// the real tolerance-driven format once the kernel exposes one.
const FIELD_WIDTH_TEMPLATE = '-999.999'

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
  const { padding: sharedPadding, motionDuration } = tokens
  // The field's own internal padding and the label-to-field gap both step
  // from the same Shared `padding` token, at half its magnitude — no
  // separate tokens needed.
  const padding = sharedPadding / 2
  const gap = sharedPadding / 2
  const prefixRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)
  // A second, always-on measurement of the prefix alone — see Button for
  // why the real prefixRef can't answer this once collapsed or squeezed.
  const naturalWidthProbeRef = useRef<HTMLSpanElement>(null)
  const [naturalPrefixWidth, setNaturalPrefixWidth] = useState<number | null>(null)
  // The field's own width used to be a flat token; now it's measured off an
  // off-viewport clone of FIELD_WIDTH_TEMPLATE, the same trick as
  // naturalWidthProbeRef below, so it stays "just wide enough" for whatever
  // font actually renders rather than an arbitrary constant.
  const fieldWidthProbeRef = useRef<HTMLSpanElement>(null)
  const [fieldWidth, setFieldWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!fieldWidthProbeRef.current) return
    const width = fieldWidthProbeRef.current.getBoundingClientRect().width
    setFieldWidth((previous) => (previous === width ? previous : width))
  }, [])

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

  // Mirrors Button's natural-width probe: the field's own width is fixed
  // (fieldWidth, added analytically below) regardless of measurement, so
  // only the prefix — whose width depends on the label text and icon —
  // needs a real, unconstrained measurement.
  useLayoutEffect(() => {
    if (!naturalWidthProbeRef.current) return
    const width = naturalWidthProbeRef.current.getBoundingClientRect().width
    setNaturalPrefixWidth((previous) => (previous === width ? previous : width))
  }, [icon, label, tokens])

  // border-box makes the input's real rendered width exactly fieldWidth
  // regardless of its padding/border, so no separate chrome tracking is
  // needed for the field itself.
  useMinSizeRegistration(
    expandedSize === null || fieldWidth === null
      ? null
      : { expanded: direction === 'row' ? expandedSize + gap + fieldWidth : expandedSize },
  )
  useNaturalWidthRegistration(
    naturalPrefixWidth === null || fieldWidth === null
      ? null
      : naturalPrefixWidth + gap + fieldWidth,
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
      {/* Off-viewport clone used only to measure the prefix's true,
          uncollapsed intrinsic width — see naturalWidthProbeRef above. */}
      <span
        aria-hidden="true"
        ref={naturalWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <CollapseProvider value={false}>
          {/* A placeholder, not the caller's own icon element — see Button
              for why this measures identically without cloning the
              caller's data-testid/key. */}
          <PrimaryContent icon={icon ? <span /> : undefined} label={label} />
        </CollapseProvider>
      </span>
      {/* Off-viewport clone used only to measure how wide the field itself
          needs to be to fit FIELD_WIDTH_TEMPLATE without clipping — see
          fieldWidthProbeRef above. */}
      <span
        aria-hidden="true"
        ref={fieldWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {FIELD_WIDTH_TEMPLATE}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="ds-interactive"
        style={
          {
            width: fieldWidth ?? undefined,
            // fieldWidth is the floor (and the row-direction, non-stretched
            // size) — flexGrow lets the field itself be "the part that gets
            // wider" when there's extra room, rather than the label growing
            // or a gap opening up between label and field.
            flexGrow: direction === 'column' ? 1 : undefined,
            padding,
            borderRadius: padding,
            boxSizing: 'border-box',
            border: 'none',
            backgroundColor: toCssColor(fieldBackground),
            color: toCssColor(fieldInk),
            '--ds-motion-duration': `${motionDuration}ms`,
          } as CSSProperties
        }
      />
    </label>
  )
}
