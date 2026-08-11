import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Button } from './design-system/Button'
import { Input } from './design-system/Input'
import { useCollapsed, useLayer } from './design-system/layer'
import { Paragraph } from './design-system/Paragraph'
import { useMinSizeRegistration } from './design-system/registry'
import { Secondary } from './design-system/Secondary'
import { toCssColor } from './design-system/theme'
import { ThemeProvider, useTheme } from './design-system/ThemeProvider'
import { computeSize } from './design-system/tokens'

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
  params: [
    { key: 'depth', label: 'Depth', defaultValue: '10' },
    { key: 'twist', label: 'Twist', defaultValue: '0' },
  ],
}

const PARAM_GAP_SCALE = { baseSize: 8, shrinkRatio: 0.85, minSize: 2 }
const HANDLE_WIDTH = 6

interface StagedActionProps {
  icon: ReactNode
  label: string
  action: Action
  values: Record<string, string>
  onValuesChange: (values: Record<string, string>) => void
}

// Drives which of an action's parameters are currently visible via its own
// drag handle. N params means N+1 stages — all shown, down to none — each
// snapped to the same way Secondary's own binary resize snaps to one of
// two: the drag tracks a start width plus the raw pointer delta, and jumps
// to whichever stage's width the cursor has crossed the midpoint toward.
// Once every param is hidden, the ancestor's ordinary collapse-to-icon
// behavior takes the final step, so this only ever governs the params —
// it doesn't duplicate that mechanism, it chains into it.
function StagedAction({ icon, label, action, values, onValuesChange }: StagedActionProps) {
  // Reads the *enclosing* Secondary's own collapse state, which only
  // exists once React actually renders that Secondary as an ancestor of
  // this component — this only works because StagedAction is rendered
  // *inside* it, not because it's called during the parent's render.
  const collapsed = useCollapsed()
  const layer = useLayer()
  const buttonRef = useRef<HTMLSpanElement>(null)
  const paramRefs = useRef<Array<HTMLSpanElement | null>>([])
  const stageWidthsRef = useRef<number[] | null>(null)
  const dragStateRef = useRef<{ startPos: number; startWidth: number } | null>(null)
  const [visibleCount, setVisibleCount] = useState(action.params.length)

  // Measured once, while every param is still visible (the initial
  // render) — mirrors Input freezing its own measurement once collapsed,
  // so a later hidden stage never needs to re-measure a display: none
  // element (which would just read back a width of 0). The gap between
  // items is read directly off real layout rather than duplicating
  // Secondary's own gap token, so it stays correct regardless of what
  // that token's tuned to.
  useLayoutEffect(() => {
    if (stageWidthsRef.current || !buttonRef.current) return
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const paramRects = paramRefs.current.map((el) => el?.getBoundingClientRect())
    if (paramRects.some((rect) => !rect)) return
    const gap = paramRects[0] ? paramRects[0]!.left - buttonRect.right : 0
    const widths = [buttonRect.width]
    let running = buttonRect.width
    for (const rect of paramRects) {
      running += gap + rect!.width
      widths.push(running)
    }
    stageWidthsRef.current = widths
  })

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current || !stageWidthsRef.current) return
      event.stopPropagation()
      if (event.buttons === 0) {
        endDrag(event)
        return
      }
      const raw = dragStateRef.current.startWidth + (event.clientX - dragStateRef.current.startPos)
      const widths = stageWidthsRef.current
      let chosen = 0
      for (let stage = 1; stage < widths.length; stage++) {
        const midpoint = (widths[stage - 1] + widths[stage]) / 2
        if (raw >= midpoint) chosen = stage
      }
      setVisibleCount(chosen)
    },
    [endDrag],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!stageWidthsRef.current) return
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragStateRef.current = {
        startPos: event.clientX,
        startWidth: stageWidthsRef.current[visibleCount],
      }
    },
    [visibleCount],
  )

  // The handle itself takes real space that the ancestor's own threshold
  // math needs to know about, the same way Secondary counts its own
  // handle's width — it isn't a Primary, so it has to register directly
  // rather than getting this for free.
  useMinSizeRegistration({ expanded: HANDLE_WIDTH, collapsed: HANDLE_WIDTH })

  // The ancestor's own collapse (root too small for anything but icons)
  // overrides whatever stage was dragged to — the same OR-cascade
  // Secondary itself uses for its binary case.
  const effectiveVisibleCount = collapsed ? 0 : visibleCount

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: computeSize(layer, PARAM_GAP_SCALE) }}
    >
      <span ref={buttonRef}>
        <Button icon={icon} label={label} onClick={() => action.run(values)} />
      </span>
      {action.params.map((param, index) => (
        <span
          key={param.key}
          ref={(el) => {
            paramRefs.current[index] = el
          }}
          style={{ display: index < effectiveVisibleCount ? undefined : 'none' }}
        >
          <Input
            label={param.label}
            value={values[param.key] ?? param.defaultValue}
            onChange={(value) => onValuesChange({ ...values, [param.key]: value })}
          />
        </span>
      ))}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          flexShrink: 0,
          alignSelf: 'stretch',
          width: HANDLE_WIDTH,
          cursor: 'col-resize',
          touchAction: 'none',
        }}
      />
    </span>
  )
}

// A parameterized action renders as a Secondary containing StagedAction,
// which owns the button, the params, and its own drag handle — reusing
// Secondary purely for its visuals and collapse cascade (background,
// padding, radius, and the "ancestor too small" override), not its own
// binary resize mechanism, which doesn't fit an N-stage decision. Nesting
// the params inside the button's own box, rather than beside it as a
// sibling, is what makes expanding read as "this button's own detail" and
// not an unrelated adjacent control, and gives each parameterized action
// its own independent stage even when several sit in the same toolbar.
function renderAction(
  key: string,
  icon: ReactNode,
  label: string,
  action: Action,
  values: Record<string, string>,
  onValuesChange: (values: Record<string, string>) => void,
) {
  if (action.params.length === 0) {
    return <Button key={key} icon={icon} label={label} onClick={() => action.run(values)} />
  }
  return (
    <Secondary key={key}>
      <StagedAction
        icon={icon}
        label={label}
        action={action}
        values={values}
        onValuesChange={onValuesChange}
      />
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
  const [extrudeValues, setExtrudeValues] = useState<Record<string, string>>({
    depth: '10',
    twist: '0',
  })
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
