import { useState } from 'react'
import { Button } from './design-system/Button'
import { Input } from './design-system/Input'
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

function AppContent() {
  const [width, setWidth] = useState('42')
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
          Design-system demo — shrink the window to see the toolbar collapse to icons, then scroll
          once it can't collapse any further.
        </Paragraph>
      </Secondary>
      <Secondary style={{ marginTop: 12 }}>
        <Button icon={<SaveIcon />} label="Save" onClick={() => console.log('save')} />
        <Button icon={<CancelIcon />} label="Cancel" />
        <Input icon={<WidthIcon />} label="Width" value={width} onChange={setWidth} />
        <Secondary>
          <Button icon={<ExtrudeIcon />} label="Extrude" />
        </Secondary>
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
