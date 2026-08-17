import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ColorRole } from './design-system/theme'
import { type ThemeMode, useTheme } from './design-system/ThemeProvider'
import { Secondary, type SecondaryItem } from './design-system/Secondary'
import type { SelectorOption } from './design-system/Selector'
import { useSetTokens, useTokens } from './design-system/TokensProvider'

// No width/height here — PrimaryContent's .primary-icon wrapper sizes this
// to 1em regardless of what any consumer's icon declares on itself. Same
// shared-wrapper pattern as App.tsx's own icons.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {children}
    </svg>
  )
}

function LightIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  )
}

function DarkIcon() {
  return (
    <Icon>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  )
}

function OsIcon() {
  return (
    <Icon>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Icon>
  )
}

const THEME_MODE_OPTIONS: SelectorOption[] = [
  { value: 'light', label: 'Light', icon: <LightIcon /> },
  { value: 'dark', label: 'Dark', icon: <DarkIcon /> },
  { value: 'auto', label: 'OS', icon: <OsIcon /> },
]

interface SettingsField {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
}

// Most settings are a label + a free-text value, rendered as an Input —
// but theme mode is a closed set of options, not a value someone types, so
// it renders as a Selector instead. One list mixing both kinds keeps a
// section's ordering as a single array rather than two parallel ones that
// would need to be interleaved by hand.
type SettingsSectionItem =
  | { kind: 'field'; field: SettingsField }
  | { kind: 'selector'; key: string; value: ThemeMode; onChange: (value: ThemeMode) => void }

interface SettingsSection {
  title: string
  items: SettingsSectionItem[]
}

function colorRoleFields(
  label: string,
  role: ColorRole,
  onChange: (role: ColorRole) => void,
): SettingsField[] {
  return (['hue', 'chroma'] as const).map((field) => ({
    key: `${label}.${field}`,
    label: `${label} ${field}`,
    value: String(role[field]),
    onChange: (raw: string) => {
      const num = Number(raw)
      if (Number.isNaN(num)) return
      onChange({ ...role, [field]: num })
    },
  }))
}

function numberField(
  label: string,
  value: number,
  onChange: (value: number) => void,
): SettingsField {
  return {
    key: label,
    label,
    value: String(value),
    onChange: (raw: string) => {
      const num = Number(raw)
      if (!Number.isNaN(num)) onChange(num)
    },
  }
}

// Always rendered, never toggled — its own permanently visible panel
// (rather than a modal/popup) is what lets a setting's effect be compared
// directly against the live canvas next to it, per the point this was
// built for. Every field reads from and writes directly to the same
// ThemeProvider/TokensProvider state every design-system component itself
// reads from — editing here is editing the real, live value, not a
// separate snapshot.
export function SettingsPanel({
  style,
  forceCollapsed,
  onNaturalWidthChange,
}: {
  style?: CSSProperties
  forceCollapsed?: boolean
  onNaturalWidthChange?: (width: number) => void
}) {
  const theme = useTheme()
  const tokens = useTokens()
  const setTokens = useSetTokens()
  // What's actually displayed while typing. A field's "real" value is
  // always derived by round-tripping through Number() -> String(), which
  // strips anything not yet a complete number ("0." becomes "0", stripping
  // the trailing dot mid-keystroke) — making it impossible to ever type a
  // decimal. This holds the user's literal input instead; onChange below
  // still only commits to the real token when it parses.
  const [rawValues, setRawValues] = useState<Record<string, string>>({})

  const sections: SettingsSection[] = [
    {
      title: 'Color',
      items: [
        { kind: 'selector', key: 'Theme mode', value: theme.themeMode, onChange: theme.setThemeMode },
        ...colorRoleFields('Accent', theme.accentRole, theme.setAccentRole).map(
          (field): SettingsSectionItem => ({ kind: 'field', field }),
        ),
        { kind: 'field', field: numberField('Contrast', theme.contrast, theme.setContrast) },
      ],
    },
    {
      // Every DesignTokens field left is a size. Every per-component size
      // value (Secondary's gap, Input's label-to-field gap and own field
      // padding, PrimaryContent's icon-to-label gap, and now every
      // component's own borderRadius too) turned out to step from padding,
      // so none of those became tokens of their own (Input's field width
      // and PrimaryContent's collapsed ellipsis width aren't tokens either
      // — see FIELD_WIDTH_TEMPLATE in Input.tsx and ELLIPSIS_WIDTH in
      // PrimaryContent.tsx). Font size isn't part of that equation — it's
      // here because it's set once on the app root and inherited
      // everywhere (see AppContent in App.tsx), not because anything ties
      // it to padding.
      title: 'Size',
      items: [
        {
          kind: 'field',
          field: numberField('Padding', tokens.padding, (v) =>
            setTokens((prev) => ({ ...prev, padding: v })),
          ),
        },
        {
          kind: 'field',
          field: numberField('Font size', tokens.fontSize, (v) =>
            setTokens((prev) => ({ ...prev, fontSize: v })),
          ),
        },
      ],
    },
    {
      // A genuinely different physical quantity from Size (time, not
      // length) — same reasoning that already kept Font size out of a
      // padding-derived equation, applied to why this doesn't just get
      // folded into the Size section above.
      title: 'Motion',
      items: [
        {
          kind: 'field',
          field: numberField('Motion duration', tokens.motionDuration, (v) =>
            setTokens((prev) => ({ ...prev, motionDuration: v })),
          ),
        },
      ],
    },
  ]

  const sectionItems: SecondaryItem[] = sections.map((section) => ({
    kind: 'secondary',
    key: section.title,
    props: {
      direction: 'column',
      items: [
        { kind: 'paragraph', key: 'title', props: { children: section.title } },
        ...section.items.map((item): SecondaryItem => {
          if (item.kind === 'selector') {
            return {
              kind: 'selector',
              key: item.key,
              props: {
                label: item.key,
                options: THEME_MODE_OPTIONS,
                value: item.value,
                // Selector deals in plain strings (it has no notion of
                // ThemeMode); safe to widen back since every option's value
                // above is a real ThemeMode literal.
                onChange: (raw) => item.onChange(raw as ThemeMode),
              },
            }
          }
          const { field } = item
          return {
            kind: 'input',
            key: field.key,
            props: {
              label: field.label,
              value: rawValues[field.key] ?? field.value,
              onChange: (raw) => {
                setRawValues((previous) => ({ ...previous, [field.key]: raw }))
                field.onChange(raw)
              },
            },
          }
        }),
      ],
    },
  }))

  return (
    <Secondary
      direction="column"
      forceCollapsed={forceCollapsed}
      onNaturalWidthChange={onNaturalWidthChange}
      style={{ height: '100%', ...style }}
      items={[{ kind: 'paragraph', key: 'title', props: { children: 'Settings' } }, ...sectionItems]}
    />
  )
}
