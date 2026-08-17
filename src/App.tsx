import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'
import { TokensProvider, useTokens } from './design-system/TokensProvider'
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
// that can), one shared signal decides for the whole set, so they collapse
// and expand together — with selfMeasure={false} on the two row-direction
// roots (below) so neither one keeps its own independent ResizeObserver
// reading racing against this shared one, which is what caused a staggered
// collapse before that was added.
//
// The threshold this compares against used to be a single hand-measured
// pixel constant. Deriving it live from each bar's real rendered content
// instead was tried and reverted once, for two reasons that no longer
// apply: settings/tools are column-direction, and the size they registered
// for their own *collapse* axis was a height sum, not the width this
// threshold needs — nothing tracked a column root's cross-axis (width)
// requirement at all. And feeding a root's own *currently rendered* width
// into a signal that also controls its siblings' widths was circular:
// misc's real available width depended on how much room settings/tools
// were currently taking, which was itself controlled by this same shared
// signal — a feedback loop that could oscillate or get stuck rather than
// converge.
//
// Secondary's onNaturalWidthChange (see design-system/Secondary.tsx) now
// answers both: it tracks a column root's true cross-axis requirement via
// its own registry (max across children, not the sum the collapse axis
// uses), and it reports each button/input's *natural*, unconstrained size —
// measured off-viewport, decoupled from whatever the real DOM currently has
// room for — never the live, possibly-squeezed rendered size, so there's no
// feedback loop to converge or get stuck in.
const CHROME_GAP = 12
const CHROME_PADDING = 12

export interface BarNaturalWidths {
  files: number
  settings: number
  tools: number
  misc: number
}

// The binding constraint used to be measured by hand as "settings/tools/
// misc side by side" (~606px), on the assumption that row is always wider
// than files' own row alone. Computing both and taking the max removes the
// need to assume which one binds — correct even if a bar's content changes
// later and shifts which row is actually the tightest.
export function requiredChromeWidth(bars: BarNaturalWidths): number {
  const secondRow = bars.settings + bars.tools + bars.misc + CHROME_GAP * 2
  return Math.max(bars.files, secondRow) + CHROME_PADDING * 2
}

function useIsNarrow(bars: BarNaturalWidths): boolean {
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return windowWidth < requiredChromeWidth(bars)
}

function AppContent() {
  const [activeTool, setActiveTool] = useState<Tool | null>(TOOLS[0]!)
  const theme = useTheme()
  const tokens = useTokens()

  const [barWidths, setBarWidths] = useState<BarNaturalWidths>({
    files: 0,
    settings: 0,
    tools: 0,
    misc: 0,
  })
  // One stable callback per bar (empty deps, functional update) rather than
  // a single `setBarWidth(key)` factory — a fresh closure identity on every
  // render would re-fire Secondary's onNaturalWidthChange effect for every
  // unrelated re-render of AppContent (e.g. switching tools), even though
  // nothing about that bar's own width changed.
  const setFilesWidth = useCallback(
    (width: number) =>
      setBarWidths((previous) =>
        previous.files === width ? previous : { ...previous, files: width },
      ),
    [],
  )
  const setSettingsWidth = useCallback(
    (width: number) =>
      setBarWidths((previous) =>
        previous.settings === width ? previous : { ...previous, settings: width },
      ),
    [],
  )
  const setToolsWidth = useCallback(
    (width: number) =>
      setBarWidths((previous) =>
        previous.tools === width ? previous : { ...previous, tools: width },
      ),
    [],
  )
  const setMiscWidth = useCallback(
    (width: number) =>
      setBarWidths((previous) =>
        previous.misc === width ? previous : { ...previous, misc: width },
      ),
    [],
  )

  const isNarrow = useIsNarrow(barWidths)

  return (
    <div
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        fontFamily: 'sans-serif',
        // The single ambient font-size every component's text inherits
        // from — see DesignTokens.fontSize in TokensProvider.tsx.
        fontSize: tokens.fontSize,
      }}
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
          gap: CHROME_GAP,
          padding: CHROME_PADDING,
          pointerEvents: 'none',
        }}
      >
        <Secondary
          forceCollapsed={isNarrow}
          selfMeasure={false}
          onNaturalWidthChange={setFilesWidth}
          style={{ gridArea: 'files' }}
          items={[
            { kind: 'button', key: 'new', props: { icon: <NewIcon />, label: 'New', onClick: () => console.log('new') } },
            { kind: 'button', key: 'open', props: { icon: <OpenIcon />, label: 'Open', onClick: () => console.log('open') } },
            { kind: 'button', key: 'save', props: { icon: <SaveIcon />, label: 'Save', onClick: () => console.log('save') } },
          ]}
        />

        <SettingsPanel
          forceCollapsed={isNarrow}
          onNaturalWidthChange={setSettingsWidth}
          style={{ gridArea: 'settings' }}
        />

        <Secondary
          direction="column"
          forceCollapsed={isNarrow}
          onNaturalWidthChange={setToolsWidth}
          style={{ gridArea: 'tools', height: '100%' }}
          items={TOOLS.map((tool) => ({
            kind: 'button' as const,
            key: tool.key,
            props: { icon: tool.icon, label: tool.label, onClick: () => setActiveTool(tool) },
          }))}
        />

        <Secondary
          forceCollapsed={isNarrow}
          selfMeasure={false}
          onNaturalWidthChange={setMiscWidth}
          style={{ gridArea: 'misc' }}
          items={[
            {
              kind: 'button',
              key: 'analysis',
              props: { icon: <AnalysisIcon />, label: 'Analysis', onClick: () => console.log('analysis') },
            },
            {
              kind: 'button',
              key: 'x-ray',
              props: { icon: <XRayIcon />, label: 'X-Ray', onClick: () => console.log('x-ray') },
            },
          ]}
        />

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
