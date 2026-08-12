import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { PrimaryContent } from './PrimaryContent'
import { useMinSizeRegistration } from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { computeSize } from './tokens'

export interface ButtonProps {
  icon?: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}

const PADDING_SCALE = { baseSize: 12, shrinkRatio: 0.6, minSize: 4 }
const RADIUS_RATIO = 0.5

export function Button({ icon, label, onClick, disabled }: ButtonProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const padding = computeSize(layer, PADDING_SCALE)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)

  // Measuring the real <button> (not just PrimaryContent's inner span)
  // means padding/border are captured automatically, whatever they are —
  // no need to separately track "chrome" this component adds.
  useLayoutEffect(() => {
    if (collapsed || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const size = direction === 'row' ? rect.width : rect.height
    setExpandedSize((previous) => (previous === size ? previous : size))
  }, [collapsed, icon, label, direction])

  useMinSizeRegistration(expandedSize === null ? null : { expanded: expandedSize })

  // One layer deeper than the enclosing Secondary's own background — reuses
  // the same layer equation to give the button a distinct surface rather
  // than introducing a separate "raised" concept.
  const background = theme.resolveBase(layer + 1)
  const ink = computeInkColor(background)

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        // A column-direction Secondary's items stretch to the width of
        // whichever sibling is widest by default (ordinary flexbox
        // align-items: stretch) — but a <button> is an inline-level box
        // that won't actually fill that stretched space on its own unless
        // told to. Row-direction toolbars are unaffected: their cross axis
        // is height, which this doesn't touch.
        width: direction === 'column' ? '100%' : undefined,
        // Needed the moment width is explicit — otherwise padding renders
        // outside the 100% box instead of inside it, the same overflow
        // Secondary's own row hit earlier for the same reason.
        boxSizing: 'border-box',
        padding,
        borderRadius: padding * RADIUS_RATIO,
        border: 'none',
        backgroundColor: toCssColor(background),
        color: toCssColor(ink),
      }}
    >
      <PrimaryContent icon={icon} label={label} />
    </button>
  )
}
