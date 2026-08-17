import type { ReactNode } from 'react'
import { useCollapsed } from './layer'
import { useTokens } from './TokensProvider'

export interface PrimaryContentProps {
  icon?: ReactNode
  label: string
}

// 1em ties the icon directly to whatever font-size is actually active in
// context (Button/Input's inherited default, Paragraph's own layer-scaled
// size, ...) rather than tracking it separately — the icon is always
// exactly as tall as the text next to it, and square since both
// dimensions use the same value.
const ICON_SIZE = '1em'

// The collapsed, icon-less fallback is a deliberately fixed-width preview —
// ellipsis truncation only kicks in because the box doesn't grow with the
// label, so there's no "expected content" to measure it against the way
// FIELD_WIDTH_TEMPLATE sizes Input's field (see Input.tsx). Sized in `em`,
// the same font-relative unit as ICON_SIZE above, instead of a flat px
// guess, so it scales with whatever font is actually active rather than
// going stale against it.
const ELLIPSIS_WIDTH = '4em'

export function PrimaryContent({ icon, label }: PrimaryContentProps) {
  const collapsed = useCollapsed()
  const { padding } = useTokens()
  // Same ratio as Input's own gap/padding — see TokensProvider.
  const primaryContentGap = padding / 2

  if (collapsed) {
    if (icon) {
      return (
        <span
          title={label}
          aria-label={label}
          className="primary-icon"
          // display must be explicit here — a plain (inline) span ignores
          // width/height entirely, so the 1em sizing would silently do
          // nothing and leave the icon's own width: 100% with no real box
          // to resolve against.
          style={{ display: 'inline-block', width: ICON_SIZE, height: ICON_SIZE }}
        >
          {icon}
        </span>
      )
    }
    return (
      <span
        title={label}
        style={{
          display: 'inline-block',
          width: ELLIPSIS_WIDTH,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: primaryContentGap,
      }}
    >
      {icon ? (
        <span
          className="primary-icon"
          style={{
            display: 'inline-block',
            width: ICON_SIZE,
            height: ICON_SIZE,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  )
}
