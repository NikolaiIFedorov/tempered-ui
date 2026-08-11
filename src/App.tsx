import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Input } from './design-system/Input'
import { useCollapsed } from './design-system/layer'
import { Paragraph } from './design-system/Paragraph'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'

function SaveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

function WidthIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
    </svg>
  )
}

function ExtrudeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="4" y="4" width="10" height="10" />
      <path d="M14 4l6 6v10H10v-6" />
    </svg>
  )
}

// An action's parameters are declared alongside it, not read off the
// callback itself — a function's own parameter names (even if reflection
// could recover them) carry no type, range, or label, so there's nothing
// to generate a real control from without a schema anyway.
interface ActionParam {
  key: string
  label: string
  defaultValue: string
}

interface Action {
  run: (values: Record<string, string>) => void
  params: ActionParam[]
}

const extrudeAction: Action = {
  run: (values) => console.log('extrude', values),
  params: [{ key: 'depth', label: 'Depth', defaultValue: '10' }],
}

// Input's own collapse behavior keeps its field visible and editable even
// when collapsed (only the label drops) — right for a value the user set
// intentionally, wrong for a parameter that's supposed to stay hidden
// until the action's own box is expanded. This reads the *nested*
// Secondary's own collapse state (not an ancestor's), which only exists
// once React actually renders that Secondary — a plain function called
// during the parent's render can't reach it, since the Provider it needs
// doesn't exist yet at that point.
function CollapsibleParams({ children }: { children: ReactNode }) {
  const collapsed = useCollapsed()
  return collapsed ? null : <>{children}</>
}

// A parameterized action renders as a resizable Secondary containing the
// button plus one Input per parameter — reusing collapse/resize exactly
// as built, rather than a bespoke "expandable Primary" concept. Nesting
// the params inside the button's own box (instead of beside it as a
// sibling) is what makes expanding read as "this button's own detail"
// and not an unrelated adjacent control, and gives each action its own
// independent expand state even when several sit in the same toolbar.
function renderAction(
  key: string,
  icon: ReactNode,
  label: string,
  action: Action,
  values: Record<string, string>,
  onValuesChange: (values: Record<string, string>) => void,
) {
  const button = <Button icon={icon} label={label} onClick={() => action.run(values)} />
  if (action.params.length === 0) {
    return <Fragment key={key}>{button}</Fragment>
  }
  return (
    <Secondary key={key} resizable>
      {button}
      <CollapsibleParams>
        {action.params.map((param) => (
          <Input
            key={param.key}
            label={param.label}
            value={values[param.key] ?? param.defaultValue}
            onChange={(value) => onValuesChange({ ...values, [param.key]: value })}
          />
        ))}
      </CollapsibleParams>
    </Secondary>
  )
}

function renderToolbarItem(
  key: string,
  width: string,
  setWidth: (value: string) => void,
  extrudeValues: Record<string, string>,
  setExtrudeValues: (values: Record<string, string>) => void,
) {
  switch (key) {
    case 'save':
      return (
        <Button key={key} icon={<SaveIcon />} label="Save" onClick={() => console.log('save')} />
      )
    case 'cancel':
      return <Button key={key} icon={<CancelIcon />} label="Cancel" />
    case 'width':
      return (
        <Input key={key} icon={<WidthIcon />} label="Width" value={width} onChange={setWidth} />
      )
    case 'extrude':
      return renderAction(
        key,
        <ExtrudeIcon />,
        'Extrude',
        extrudeAction,
        extrudeValues,
        setExtrudeValues,
      )
    default:
      return null
  }
}

function AppContent() {
  const [width, setWidth] = useState('42')
  const [extrudeValues, setExtrudeValues] = useState<Record<string, string>>({ depth: '10' })
  const [order, setOrder] = useState(['save', 'cancel', 'width', 'extrude'])
  const theme = useTheme()

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 16,
        fontFamily: 'sans-serif',
        backgroundColor: toCssColor(theme.resolveCanvas()),
      }}
    >
      <Secondary direction="column">
        <Paragraph>
          Design-system demo — shrink the window to see the toolbar collapse to icons, drag the
          handle on the right edge to resize it, and drag items to reorder them.
        </Paragraph>
      </Secondary>
      <Secondary resizable onReorder={setOrder} style={{ marginTop: 12 }}>
        {order.map((key) =>
          renderToolbarItem(key, width, setWidth, extrudeValues, setExtrudeValues),
        )}
      </Secondary>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
