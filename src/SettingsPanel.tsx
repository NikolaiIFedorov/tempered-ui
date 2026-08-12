import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Input } from './design-system/Input'
import { Paragraph } from './design-system/Paragraph'
import { Secondary } from './design-system/Secondary'

interface SettingsField {
  key: string
  label: string
  value: string
}

interface SettingsSection {
  title: string
  fields: SettingsField[]
}

// A live inventory of every tunable constant across the design system,
// grouped by the component that owns it — a starting point, not yet wired
// back to actually affect rendering. Each component currently reads its
// own local const directly; making these live would mean routing that
// through a shared, mutable source instead, which is a separate task from
// just getting every value laid out and visible here first.
const SECTIONS: SettingsSection[] = [
  {
    title: 'Color',
    fields: [
      { key: 'color.base.hue', label: 'Base hue', value: '250' },
      { key: 'color.base.chroma', label: 'Base chroma', value: '0.015' },
      { key: 'color.base.lMin', label: 'Base lMin', value: '0.05' },
      { key: 'color.base.lMax', label: 'Base lMax', value: '0.95' },
      { key: 'color.accent.hue', label: 'Accent hue', value: '250' },
      { key: 'color.accent.chroma', label: 'Accent chroma', value: '0.15' },
      { key: 'color.accent.lMin', label: 'Accent lMin', value: '0.2' },
      { key: 'color.accent.lMax', label: 'Accent lMax', value: '0.8' },
      { key: 'color.lStep', label: 'Lstep', value: '0.22' },
    ],
  },
  {
    title: 'Secondary',
    fields: [
      { key: 'secondary.gap.baseSize', label: 'Gap baseSize', value: '8' },
      { key: 'secondary.gap.shrinkRatio', label: 'Gap shrinkRatio', value: '0.85' },
      { key: 'secondary.gap.minSize', label: 'Gap minSize', value: '2' },
      { key: 'secondary.padding.baseSize', label: 'Padding baseSize', value: '12' },
      { key: 'secondary.padding.shrinkRatio', label: 'Padding shrinkRatio', value: '0.6' },
      { key: 'secondary.padding.minSize', label: 'Padding minSize', value: '4' },
      { key: 'secondary.radiusRatio', label: 'Radius ratio', value: '0.5' },
    ],
  },
  {
    title: 'Button',
    fields: [
      { key: 'button.padding.baseSize', label: 'Padding baseSize', value: '12' },
      { key: 'button.padding.shrinkRatio', label: 'Padding shrinkRatio', value: '0.6' },
      { key: 'button.padding.minSize', label: 'Padding minSize', value: '4' },
      { key: 'button.radiusRatio', label: 'Radius ratio', value: '0.5' },
    ],
  },
  {
    title: 'Input',
    fields: [
      { key: 'input.fieldWidth.baseSize', label: 'Field width baseSize', value: '96' },
      { key: 'input.fieldWidth.shrinkRatio', label: 'Field width shrinkRatio', value: '0.85' },
      { key: 'input.fieldWidth.minSize', label: 'Field width minSize', value: '48' },
      { key: 'input.gap.baseSize', label: 'Gap baseSize', value: '8' },
      { key: 'input.gap.shrinkRatio', label: 'Gap shrinkRatio', value: '0.85' },
      { key: 'input.gap.minSize', label: 'Gap minSize', value: '4' },
      { key: 'input.padding.baseSize', label: 'Padding baseSize', value: '6' },
      { key: 'input.padding.shrinkRatio', label: 'Padding shrinkRatio', value: '0.6' },
      { key: 'input.padding.minSize', label: 'Padding minSize', value: '2' },
      { key: 'input.radiusRatio', label: 'Radius ratio', value: '0.5' },
    ],
  },
  {
    title: 'Paragraph',
    fields: [
      { key: 'paragraph.fontSize.baseSize', label: 'Font size baseSize', value: '14' },
      { key: 'paragraph.fontSize.shrinkRatio', label: 'Font size shrinkRatio', value: '0.9' },
      { key: 'paragraph.fontSize.minSize', label: 'Font size minSize', value: '10' },
    ],
  },
  {
    title: 'Primary content',
    fields: [
      { key: 'primaryContent.gap.baseSize', label: 'Gap baseSize', value: '6' },
      { key: 'primaryContent.gap.shrinkRatio', label: 'Gap shrinkRatio', value: '0.85' },
      { key: 'primaryContent.gap.minSize', label: 'Gap minSize', value: '2' },
      { key: 'primaryContent.ellipsisWidth', label: 'Ellipsis width', value: '24' },
    ],
  },
]

// Always rendered, never toggled — its own permanently visible panel
// (rather than a modal/popup) is what lets a setting's effect be compared
// directly against the live canvas next to it, per the point this was
// built for.
export function SettingsPanel({ style }: { style?: CSSProperties }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(SECTIONS.flatMap((section) => section.fields.map((f) => [f.key, f.value]))),
  )

  return (
    <Secondary direction="column" style={{ height: '100%', ...style }}>
      <Paragraph>Settings</Paragraph>
      {SECTIONS.map((section) => (
        <Secondary key={section.title} direction="column">
          <Paragraph>{section.title}</Paragraph>
          {section.fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={values[field.key] ?? field.value}
              onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
            />
          ))}
        </Secondary>
      ))}
    </Secondary>
  )
}
