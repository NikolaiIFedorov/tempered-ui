import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {children}
    </svg>
  )
}

function NewIcon() {
  return (
    <Icon>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M13 2v7h7" />
      <path d="M12 12v6M9 15h6" />
    </Icon>
  )
}

function OpenIcon() {
  return (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Icon>
  )
}

function SaveIcon() {
  return (
    <Icon>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </Icon>
  )
}

function SelectIcon() {
  return (
    <Icon>
      <path d="M4 3l7 17 2.5-7.5L21 10Z" />
    </Icon>
  )
}

function ExtrudeIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="10" height="10" />
      <path d="M14 4l6 6v10H10v-6" />
    </Icon>
  )
}

function SketchIcon() {
  return (
    <Icon>
      <path d="M3 21l3-1 11-11-2-2L4 18Z" />
      <path d="M14 7l3-3 2 2-3 3" />
    </Icon>
  )
}

function MoveIcon() {
  return (
    <Icon>
      <path d="M12 2v20M2 12h20" />
      <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" />
    </Icon>
  )
}

function AnalysisIcon() {
  return (
    <Icon>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </Icon>
  )
}

function XRayIcon() {
  return (
    <Icon>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

interface Tool {
  key: string
  icon: ReactNode
  label: string
}

const TOOLS: Tool[] = [
  { key: 'select', icon: <SelectIcon />, label: 'Select' },
  { key: 'extrude', icon: <ExtrudeIcon />, label: 'Extrude' },
  { key: 'sketch', icon: <SketchIcon />, label: 'Sketch' },
  { key: 'move', icon: <MoveIcon />, label: 'Move' },
]

function AppContent() {
  const [activeTool, setActiveTool] = useState<Tool | null>(TOOLS[0]!)
  const theme = useTheme()

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr',
        gridTemplateRows: 'auto 1fr',
        gridTemplateAreas: `"files tools misc" "files tools canvas"`,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ gridArea: 'files' }}>
        <Secondary direction="column" style={{ height: '100%', borderRadius: 0 }}>
          <Button icon={<NewIcon />} label="New" onClick={() => console.log('new')} />
          <Button icon={<OpenIcon />} label="Open" onClick={() => console.log('open')} />
          <Button icon={<SaveIcon />} label="Save" onClick={() => console.log('save')} />
        </Secondary>
      </div>

      <div style={{ gridArea: 'tools' }}>
        <Secondary direction="column" style={{ height: '100%', borderRadius: 0 }}>
          {TOOLS.map((tool) => (
            <Button
              key={tool.key}
              icon={tool.icon}
              label={tool.label}
              onClick={() => setActiveTool(tool)}
            />
          ))}
        </Secondary>
      </div>

      <div style={{ gridArea: 'misc' }}>
        <Secondary style={{ borderRadius: 0 }}>
          <Button
            icon={<AnalysisIcon />}
            label="Analysis"
            onClick={() => console.log('analysis')}
          />
          <Button icon={<XRayIcon />} label="X-Ray" onClick={() => console.log('x-ray')} />
        </Secondary>
      </div>

      <div
        style={{
          gridArea: 'canvas',
          position: 'relative',
          backgroundColor: toCssColor(theme.resolveCanvas()),
        }}
      >
        {activeTool ? (
          // Default position only — top-left of the canvas area, just below
          // the misc bar. Free repositioning is deferred: onReorder only
          // swaps items within one Secondary's own list, it doesn't do free
          // 2D placement, and desktop position doesn't actually matter here
          // (touch enforces top-left as the reachable corner regardless).
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <Secondary>
              <Button icon={activeTool.icon} label={activeTool.label} />
            </Secondary>
          </div>
        ) : null}
      </div>
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
