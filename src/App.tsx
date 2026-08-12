import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'

// No width/height here — PrimaryContent's .primary-icon wrapper sizes
// this to 1em (matching text height) regardless of what any consumer's
// icon declares on itself.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
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
      style={{ position: 'relative', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}
    >
      {/* The eventual WASM viewport — full-bleed behind everything, not
          confined to a sub-rectangle the chrome carves out. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: toCssColor(theme.resolveCanvas()),
        }}
      />

      {/* UI chrome floats over the canvas via this same grid as before,
          just as a transparent overlay instead of something that reserves
          canvas space. pointerEvents: none here lets clicks in empty grid
          cells (most of "canvas") fall through to the viewport underneath
          — each Secondary's own visible row re-enables it automatically,
          its invisible measurement shell (where one exists) never does. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr',
          gridTemplateRows: 'auto auto 1fr',
          gridTemplateAreas: `"files files files" "settings tools misc" "settings tools canvas"`,
          gap: 12,
          padding: 12,
          pointerEvents: 'none',
        }}
      >
        <Secondary style={{ gridArea: 'files' }}>
          <Button icon={<NewIcon />} label="New" onClick={() => console.log('new')} />
          <Button icon={<OpenIcon />} label="Open" onClick={() => console.log('open')} />
          <Button icon={<SaveIcon />} label="Save" onClick={() => console.log('save')} />
        </Secondary>

        <Secondary direction="column" style={{ gridArea: 'settings', height: '100%' }}>
          <Button
            icon={<SettingsIcon />}
            label="Settings"
            onClick={() => console.log('settings')}
          />
        </Secondary>

        <Secondary direction="column" style={{ gridArea: 'tools', height: '100%' }}>
          {TOOLS.map((tool) => (
            <Button
              key={tool.key}
              icon={tool.icon}
              label={tool.label}
              onClick={() => setActiveTool(tool)}
            />
          ))}
        </Secondary>

        <Secondary style={{ gridArea: 'misc' }}>
          <Button
            icon={<AnalysisIcon />}
            label="Analysis"
            onClick={() => console.log('analysis')}
          />
          <Button icon={<XRayIcon />} label="X-Ray" onClick={() => console.log('x-ray')} />
        </Secondary>

        {activeTool ? (
          // Default position only, achieved for free by sitting in the same
          // grid cell as the (otherwise empty) canvas area — top-left of
          // it, just below the misc bar. The grid's own gap already spaces
          // it from the tools/misc bars, same as every other cell — no
          // margin of its own needed on top of that. Free repositioning is
          // deferred: onReorder only swaps items within one Secondary's
          // own list, it doesn't do free 2D placement, and desktop
          // position doesn't actually matter here (touch enforces top-left
          // as the reachable corner regardless).
          <Secondary style={{ gridArea: 'canvas' }}>
            <Button icon={activeTool.icon} label={activeTool.label} />
          </Secondary>
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
