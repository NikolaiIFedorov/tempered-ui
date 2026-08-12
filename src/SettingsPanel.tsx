import type { CSSProperties } from 'react'
import { Input } from './design-system/Input'
import type { ColorRole } from './design-system/theme'
import { useTheme } from './design-system/ThemeProvider'
import { Paragraph } from './design-system/Paragraph'
import { Secondary } from './design-system/Secondary'
import type { SizeScale } from './design-system/tokens'
import { useSetTokens, useTokens } from './design-system/TokensProvider'

interface SettingsField {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
}

interface SettingsSection {
  title: string
  fields: SettingsField[]
}

function sizeScaleFields(
  label: string,
  scale: SizeScale,
  onChange: (scale: SizeScale) => void,
): SettingsField[] {
  return (['baseSize', 'shrinkRatio', 'minSize'] as const).map((field) => ({
    key: `${label}.${field}`,
    label: `${label} ${field}`,
    value: String(scale[field]),
    onChange: (raw: string) => {
      const num = Number(raw)
      if (Number.isNaN(num)) return
      onChange({ ...scale, [field]: num })
    },
  }))
}

function colorRoleFields(
  label: string,
  role: ColorRole,
  onChange: (role: ColorRole) => void,
): SettingsField[] {
  return (['hue', 'chroma', 'lMin', 'lMax'] as const).map((field) => ({
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
export function SettingsPanel({ style }: { style?: CSSProperties }) {
  const theme = useTheme()
  const tokens = useTokens()
  const setTokens = useSetTokens()

  const sections: SettingsSection[] = [
    {
      title: 'Color',
      fields: [
        ...colorRoleFields('Base', theme.baseRole, theme.setBaseRole),
        ...colorRoleFields('Accent', theme.accentRole, theme.setAccentRole),
        numberField('Lstep', theme.lStep, theme.setLStep),
      ],
    },
    {
      title: 'Secondary',
      fields: [
        ...sizeScaleFields('Gap', tokens.secondaryGap, (v) =>
          setTokens((prev) => ({ ...prev, secondaryGap: v })),
        ),
        ...sizeScaleFields('Padding', tokens.secondaryPadding, (v) =>
          setTokens((prev) => ({ ...prev, secondaryPadding: v })),
        ),
        numberField('Radius ratio', tokens.secondaryRadiusRatio, (v) =>
          setTokens((prev) => ({ ...prev, secondaryRadiusRatio: v })),
        ),
      ],
    },
    {
      title: 'Button',
      fields: [
        ...sizeScaleFields('Padding', tokens.buttonPadding, (v) =>
          setTokens((prev) => ({ ...prev, buttonPadding: v })),
        ),
        numberField('Radius ratio', tokens.buttonRadiusRatio, (v) =>
          setTokens((prev) => ({ ...prev, buttonRadiusRatio: v })),
        ),
      ],
    },
    {
      title: 'Input',
      fields: [
        ...sizeScaleFields('Field width', tokens.inputFieldWidth, (v) =>
          setTokens((prev) => ({ ...prev, inputFieldWidth: v })),
        ),
        ...sizeScaleFields('Gap', tokens.inputGap, (v) =>
          setTokens((prev) => ({ ...prev, inputGap: v })),
        ),
        ...sizeScaleFields('Padding', tokens.inputPadding, (v) =>
          setTokens((prev) => ({ ...prev, inputPadding: v })),
        ),
        numberField('Radius ratio', tokens.inputRadiusRatio, (v) =>
          setTokens((prev) => ({ ...prev, inputRadiusRatio: v })),
        ),
      ],
    },
    {
      title: 'Paragraph',
      fields: sizeScaleFields('Font size', tokens.paragraphFontSize, (v) =>
        setTokens((prev) => ({ ...prev, paragraphFontSize: v })),
      ),
    },
    {
      title: 'Primary content',
      fields: [
        ...sizeScaleFields('Gap', tokens.primaryContentGap, (v) =>
          setTokens((prev) => ({ ...prev, primaryContentGap: v })),
        ),
        numberField('Ellipsis width', tokens.primaryContentEllipsisWidth, (v) =>
          setTokens((prev) => ({ ...prev, primaryContentEllipsisWidth: v })),
        ),
      ],
    },
  ]

  return (
    <Secondary direction="column" style={{ height: '100%', ...style }}>
      <Paragraph>Settings</Paragraph>
      {sections.map((section) => (
        <Secondary key={section.title} direction="column">
          <Paragraph>{section.title}</Paragraph>
          {section.fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={field.value}
              onChange={field.onChange}
            />
          ))}
        </Secondary>
      ))}
    </Secondary>
  )
}
