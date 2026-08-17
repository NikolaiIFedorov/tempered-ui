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

export interface SelectorOption {
  value: string
  icon?: ReactNode
  label: string
}

export interface SelectorProps {
  // Optional — Input always shows one (what value am I?), but a Selector's
  // options can be self-explanatory (icons alone) often enough that this
  // shouldn't be required. When given, it's rendered as a plain, icon-less
  // PrimaryContent — the same "collapse to an ellipsis fragment when there's
  // no icon to fall back to" behavior Input's own label already gets for
  // free, not a second mechanism.
  label?: string
  options: SelectorOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// One option's own button. Reads whatever ambient collapse state it's
// nested under — the real one live, or a probe's forced true/false below —
// via useCollapsed(), same as Button does, then adds a second, independent
// reason to collapse on top: not being the selected option. Composing the
// two here (rather than each option deciding collapse on its own) is what
// makes "the whole Selector collapses under space pressure" and "only the
// unselected options collapse otherwise" the same mechanism instead of two.
function SelectorOptionButton({
  option,
  selected,
  onClick,
  disabled,
}: {
  option: SelectorOption
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const ambientCollapsed = useCollapsed()
  const layer = useLayer()
  const theme = useTheme()
  const { padding, motionDuration } = useTokens()

  // The selected option gets the accent surface instead of the ordinary
  // one-layer-deeper base surface every other Primary uses — the first
  // real use of resolveAccent, which existed for exactly this: marking
  // the active choice, not just decoration. .ds-interactive's transition
  // on background-color is what makes this swap glide instead of snap the
  // instant `selected` flips.
  const background = selected ? theme.resolveAccent(layer + 1) : theme.resolveBase(layer + 1)
  const ink = computeInkColor(background)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ds-interactive"
      style={
        {
          boxSizing: 'border-box',
          // Vertical padding, specifically, is what made this button taller
          // than the plain text sitting next to it (the label caption, an
          // adjacent Button, ...) — the same mismatch icons used to have
          // before PrimaryContent pinned them to 1em. Padding only
          // horizontally keeps the button's own height pinned to its
          // content's natural height (the 1em icon, or a line of text)
          // instead of padding inflating it, while still leaving room to
          // click on either side.
          padding: `0 ${padding}px`,
          borderRadius: padding,
          border: 'none',
          backgroundColor: toCssColor(background),
          color: toCssColor(ink),
          '--ds-motion-duration': `${motionDuration}ms`,
        } as CSSProperties
      }
    >
      <CollapseProvider value={ambientCollapsed || !selected}>
        <PrimaryContent icon={option.icon} label={option.label} />
      </CollapseProvider>
    </button>
  )
}

export function Selector({ label, options, value, onChange, disabled }: SelectorProps) {
  const collapsed = useCollapsed()
  const direction = useSecondaryDirection()
  const tokens = useTokens()
  const { padding } = tokens
  const rowRef = useRef<HTMLDivElement>(null)
  const [expandedSize, setExpandedSize] = useState<number | null>(null)
  // A second, always-on measurement, independent of both the row's current
  // collapse state and the space its container currently has to offer —
  // see the probe below for why.
  const naturalWidthProbeRef = useRef<HTMLDivElement>(null)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  // Same probe, its other dimension — see registry.ts's NaturalHeightRegistry
  // for why a row-direction root's own natural height needs tracking too.
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  // A second, independent probe forced *collapsed* rather than expanded —
  // see registry.ts's NaturalCollapsedWidthRegistry for why a column root
  // needs this as a distinct number from naturalWidth above, not derived
  // from it.
  const naturalCollapsedWidthProbeRef = useRef<HTMLDivElement>(null)
  const [naturalCollapsedWidth, setNaturalCollapsedWidth] = useState<number | null>(null)

  // Measuring the real row (not a clone) captures whichever option is
  // currently selected showing its label, exactly as rendered — see Button
  // for why this measurement is skipped once actually collapsed.
  useLayoutEffect(() => {
    if (collapsed || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const size = direction === 'row' ? rect.width : rect.height
    setExpandedSize((previous) => (previous === size ? previous : size))
  }, [collapsed, label, options, value, direction, tokens])

  // Ambient collapse forced off — reports the row's true footprint with
  // both the label caption (if any) and whichever option is selected still
  // showing their text, regardless of the real row's live collapse state.
  // See Button's own naturalWidthProbeRef for why a live rect can't answer
  // this once actually collapsed or squeezed.
  useLayoutEffect(() => {
    if (!naturalWidthProbeRef.current) return
    const rect = naturalWidthProbeRef.current.getBoundingClientRect()
    setNaturalWidth((previous) => (previous === rect.width ? previous : rect.width))
    setNaturalHeight((previous) => (previous === rect.height ? previous : rect.height))
  }, [label, options, value, tokens])

  // Ambient collapse forced on — the label caption (if any) and every
  // option icon-only, the counterpart to the probe above for a column
  // root's cross-axis floor once it's actually collapsed.
  useLayoutEffect(() => {
    if (!naturalCollapsedWidthProbeRef.current) return
    const width = naturalCollapsedWidthProbeRef.current.getBoundingClientRect().width
    setNaturalCollapsedWidth((previous) => (previous === width ? previous : width))
  }, [label, options, tokens])

  useMinSizeRegistration(expandedSize === null ? null : { expanded: expandedSize })
  useNaturalWidthRegistration(naturalWidth)
  useNaturalHeightRegistration(naturalHeight)
  useNaturalCollapsedWidthRegistration(naturalCollapsedWidth)

  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        gap: padding,
        boxSizing: 'border-box',
        // Same reasoning as Button/Input: a column-direction Secondary
        // stretches its items to the widest sibling, but a plain div won't
        // fill that on its own.
        width: direction === 'column' ? '100%' : undefined,
      }}
    >
      {label !== undefined ? <PrimaryContent label={label} /> : null}
      {options.map((option) => (
        <SelectorOptionButton
          key={option.value}
          option={option}
          selected={option.value === value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        />
      ))}
      {/* Off-viewport clone used only to measure the row's true,
          uncollapsed intrinsic width — see naturalWidthProbeRef above. */}
      <div
        aria-hidden="true"
        ref={naturalWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          gap: padding,
        }}
      >
        <CollapseProvider value={false}>
          {label !== undefined ? <PrimaryContent label={label} /> : null}
          {options.map((option) => (
            <SelectorOptionButton
              key={option.value}
              option={{ ...option, icon: option.icon ? <span /> : undefined }}
              selected={option.value === value}
              onClick={() => {}}
            />
          ))}
        </CollapseProvider>
      </div>
      {/* Off-viewport clone forced *collapsed* — the icon-only counterpart
          to the probe above, for a column root's cross-axis floor once it's
          actually collapsed (see naturalCollapsedWidthProbeRef above). */}
      <div
        aria-hidden="true"
        ref={naturalCollapsedWidthProbeRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          gap: padding,
        }}
      >
        <CollapseProvider value={true}>
          {label !== undefined ? <PrimaryContent label={label} /> : null}
          {options.map((option) => (
            <SelectorOptionButton
              key={option.value}
              option={{ ...option, icon: option.icon ? <span /> : undefined }}
              selected={option.value === value}
              onClick={() => {}}
            />
          ))}
        </CollapseProvider>
      </div>
    </div>
  )
}
