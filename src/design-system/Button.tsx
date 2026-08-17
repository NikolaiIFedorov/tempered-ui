import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CollapseProvider, useCollapsed, useLayer, useSecondaryDirection } from './layer'
import { PrimaryContent } from './PrimaryContent'
import {
  useMinSizeRegistration,
  useNaturalCollapsedWidthRegistration,
  useNaturalHeightRegistration,
  useNaturalWidthRegistration,
} from './registry'
import { computeInkColor, toCssColor } from './theme'
import { useTheme } from './ThemeProvider'
import { useTokens } from './TokensProvider'

export interface ButtonProps {
  icon?: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}

export function Button({ icon, label, onClick, disabled }: ButtonProps) {
  const layer = useLayer()
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const theme = useTheme()
  const tokens = useTokens()
  const { padding, motionDuration } = tokens
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)
  // A second, always-on measurement, independent of both the real button's
  // current collapse state and the space its container currently has to
  // offer — see the probe below for why.
  const naturalWidthProbeRef = useRef<HTMLSpanElement>(null)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  // Same probe, its other dimension — see registry.ts's NaturalHeightRegistry
  // for why a row-direction root's own natural height needs tracking too.
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  // A second, independent probe forced *collapsed* rather than expanded —
  // see registry.ts's NaturalCollapsedWidthRegistry for why a column root
  // needs this as a distinct number from naturalWidth above, not derived
  // from it.
  const naturalCollapsedWidthProbeRef = useRef<HTMLSpanElement>(null)
  const [naturalCollapsedWidth, setNaturalCollapsedWidth] = useState<number | null>(null)

  // Measuring the real <button> (not just PrimaryContent's inner span)
  // means padding/border are captured automatically, whatever they are —
  // no need to separately track "chrome" this component adds. tokens (the
  // whole object, not just padding) is in deps so a live Settings
  // edit re-measures and re-registers rather than only re-painting — this
  // stays correct even for indirect effects (e.g. PrimaryContent's own
  // gap token changing this button's rendered width) without needing to
  // track every token that could possibly affect it individually.
  useLayoutEffect(() => {
    if (collapsed || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const size = direction === 'row' ? rect.width : rect.height
    setExpandedSize((previous) => (previous === size ? previous : size))
  }, [collapsed, icon, label, direction, tokens])

  // The real button's own rect can't answer "how wide would this be with
  // its label showing" once it's actually collapsed or squeezed by a tight
  // container — a column stretches every button to its container's current
  // width, which itself can shrink below the label's true content need
  // under space pressure, so reading rect.width there would report the
  // squeeze, not the requirement, and feed a decision meant to relieve
  // that squeeze with an already-squeezed number. This clone sits off-
  // viewport at its own intrinsic width, forced to its uncollapsed form
  // regardless of the real button's live collapse state, so it always
  // reports the true, unconstrained answer.
  useLayoutEffect(() => {
    if (!naturalWidthProbeRef.current) return
    const rect = naturalWidthProbeRef.current.getBoundingClientRect()
    setNaturalWidth((previous) => (previous === rect.width ? previous : rect.width))
    setNaturalHeight((previous) => (previous === rect.height ? previous : rect.height))
  }, [icon, label, tokens])

  useLayoutEffect(() => {
    if (!naturalCollapsedWidthProbeRef.current) return
    const width = naturalCollapsedWidthProbeRef.current.getBoundingClientRect().width
    setNaturalCollapsedWidth((previous) => (previous === width ? previous : width))
  }, [icon, label, tokens])

  useMinSizeRegistration(expandedSize === null ? null : { expanded: expandedSize })
  useNaturalWidthRegistration(naturalWidth)
  useNaturalHeightRegistration(naturalHeight)
  useNaturalCollapsedWidthRegistration(naturalCollapsedWidth)

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
      className="ds-interactive"
      style={
        {
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
          borderRadius: padding,
          border: 'none',
          backgroundColor: toCssColor(background),
          color: toCssColor(ink),
          '--ds-motion-duration': `${motionDuration}ms`,
        } as CSSProperties
      }
    >
      <PrimaryContent icon={icon} label={label} />
      {/* Off-viewport clone used only to measure the button's true,
          uncollapsed intrinsic width — see naturalWidthProbeRef above. Not
          part of the visible button; nested inside it purely so it inherits
          the same layer/token context without needing its own providers.
          A <span>, not a <div> — <button> only permits phrasing content. */}
      <span
        aria-hidden="true"
        ref={naturalWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'inline-block',
          boxSizing: 'border-box',
          padding,
        }}
      >
        <CollapseProvider value={false}>
          {/* A placeholder, not the caller's own icon element — PrimaryContent
              always boxes an icon to exactly 1em square regardless of its
              content, so this measures identically, without also cloning
              whatever data-testid/key the caller's icon carries. */}
          <PrimaryContent icon={icon ? <span /> : undefined} label={label} />
        </CollapseProvider>
      </span>
      {/* Off-viewport clone forced *collapsed* — the icon-only counterpart to
          the probe above, for a column root's cross-axis floor once it's
          actually collapsed (see naturalCollapsedWidthProbeRef above). */}
      <span
        aria-hidden="true"
        ref={naturalCollapsedWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'inline-block',
          boxSizing: 'border-box',
          padding,
        }}
      >
        <CollapseProvider value={true}>
          <PrimaryContent icon={icon ? <span /> : undefined} label={label} />
        </CollapseProvider>
      </span>
    </button>
  )
}
