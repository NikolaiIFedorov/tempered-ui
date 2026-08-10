import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCollapsed, useLayer } from './layer'
import { computeCollapsedContentWidth, PrimaryContent } from './PrimaryContent'
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

const PADDING_SCALE = { baseSize: 12, shrinkRatio: 0.85, minSize: 4 }

export function Button({ icon, label, onClick, disabled }: ButtonProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const theme = useTheme()
  const padding = computeSize(layer, PADDING_SCALE)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [expandedWidth, setExpandedWidth] = useState<number | null>(null)

  // Measuring the real <button> (not just PrimaryContent's inner span)
  // means padding/border are captured automatically, whatever they are —
  // no need to separately track "chrome" this component adds.
  useLayoutEffect(() => {
    if (collapsed || !buttonRef.current) return
    const width = buttonRef.current.getBoundingClientRect().width
    setExpandedWidth((previous) => (previous === width ? previous : width))
  }, [collapsed, icon, label])

  const collapsedWidth = padding * 2 + computeCollapsedContentWidth(layer, Boolean(icon))

  useMinSizeRegistration(
    expandedWidth === null ? null : { expanded: expandedWidth, collapsed: collapsedWidth },
  )

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
        padding,
        border: 'none',
        backgroundColor: toCssColor(background),
        color: toCssColor(ink),
      }}
    >
      <PrimaryContent icon={icon} label={label} />
    </button>
  )
}
