import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'
import { TokensProvider } from './design-system/TokensProvider'
import { SettingsPanel } from './SettingsPanel'

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

// Files/misc are row-direction roots, so they already self-measure and
// collapse independently — but tools/settings are column-direction roots,
// which deliberately never self-measure at all (a column's height has no
// real external constraint in ordinary page flow, so doing so would be
// self-referential). Left alone, that means only two of the four bars can
// ever respond to the window narrowing. Rather than have each bar decide
// independently anyway (which would look inconsistent even for the two
// that can), one shared width breakpoint decides for the whole set, so
// they collapse and expand together — with selfMeasure={false} on the two
// row-direction roots (App.tsx) so neither one keeps its own independent
// ResizeObserver reading racing against this shared one, which is what
// caused a staggered collapse before that was added.
//
// A tempting alternative is deriving this threshold live from each bar's
// real rendered content instead of a hand-measured number — tried and
// reverted. It breaks two ways: first, settings/tools are column-direction,
// so the size they register for their own *collapse* axis is a height sum,
// not the width this threshold actually needs — there's no existing
// mechanism that tracks a column root's cross-axis (width) requirement at
// all. Second, feeding any root's own *currently rendered* width into a
// signal that also controls its siblings' widths is circular: misc's real
// available width depends on how much room settings/tools are currently
// taking, which is itself controlled by this same shared signal — a
// feedback loop that can oscillate or get stuck rather than converge.
//
// The number here is still measured, not guessed, and rechecked against
// what the layout actually needs (~606px for settings/tools/misc side by
// side, the largest of the four bars' requirements) — but with a
// deliberately generous margin on top, rather than a tight fit, since a
// real browser's font metrics won't exactly match whatever this was last
// measured against, and the gap between a real resize and this signal
// catching up (a window 'resize' event reaching React one JS tick after
// the browser already reflowed) needs real slack too.
const NARROW_BREAKPOINT = 760

function useIsNarrow(breakpoint: number): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isNarrow
}

function AppContent() {
  const [activeTool, setActiveTool] = useState<Tool | null>(TOOLS[0]!)
  const theme = useTheme()
  const isNarrow = useIsNarrow(NARROW_BREAKPOINT)

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
        <Secondary forceCollapsed={isNarrow} selfMeasure={false} style={{ gridArea: 'files' }}>
          <Button icon={<NewIcon />} label="New" onClick={() => console.log('new')} />
          <Button icon={<OpenIcon />} label="Open" onClick={() => console.log('open')} />
          <Button icon={<SaveIcon />} label="Save" onClick={() => console.log('save')} />
        </Secondary>

        <SettingsPanel forceCollapsed={isNarrow} style={{ gridArea: 'settings' }} />

        <Secondary
          direction="column"
          forceCollapsed={isNarrow}
          style={{ gridArea: 'tools', height: '100%' }}
        >
          {TOOLS.map((tool) => (
            <Button
              key={tool.key}
              icon={tool.icon}
              label={tool.label}
              onClick={() => setActiveTool(tool)}
            />
          ))}
        </Secondary>

        <Secondary forceCollapsed={isNarrow} selfMeasure={false} style={{ gridArea: 'misc' }}>
          <Button
            icon={<AnalysisIcon />}
            label="Analysis"
            onClick={() => console.log('analysis')}
          />
          <Button icon={<XRayIcon />} label="X-Ray" onClick={() => console.log('x-ray')} />
        </Secondary>

        {activeTool ? (
          // A bare Button, not a Secondary: it's a single free-floating
          // control, not a toolbar grouping, and Button already paints its
          // own background — wrapping it in a Secondary added a second,
          // redundant background box around it. It also sits in the
          // 'canvas' grid cell, which spans the entire remaining viewport
          // (row/column both 1fr) — a Secondary placed there stretches to
          // fill that whole cell by CSS Grid's default align-items:
          // stretch, which is what made that second box look like an
          // oversized empty panel rather than a compact button. Sizing
          // this wrapper to its own content instead keeps it exactly
          // button-sized regardless of how much free space "canvas" has.
          // Default position only, achieved for free by sitting in the
          // same grid cell as the (otherwise empty) canvas area — top-left
          // of it, just below the misc bar. The grid's own gap already
          // spaces it from the tools/misc bars, same as every other cell —
          // no margin of its own needed on top of that. Free repositioning
          // is deferred: desktop position doesn't actually matter here
          // (touch enforces top-left as the reachable corner regardless).
          <div
            style={{
              gridArea: 'canvas',
              width: 'fit-content',
              height: 'fit-content',
              pointerEvents: 'auto',
            }}
          >
            <Button icon={activeTool.icon} label={activeTool.label} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <TokensProvider>
        <AppContent />
      </TokensProvider>
    </ThemeProvider>
  )
}

export default App
