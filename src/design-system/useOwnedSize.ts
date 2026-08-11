import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface UseOwnedSizeOptions {
  axis: 'x' | 'y'
  min: number
  // Whether dragging is currently allowed at all — when false, handleProps
  // is null so nothing renders a handle or attaches listeners.
  enabled: boolean
}

export interface OwnedSize<T extends HTMLElement> {
  // Attach to the element whose current rendered size should be read when
  // a drag starts.
  ref: React.RefObject<T | null>
  // The effective size: the user's override once they've dragged, or
  // defaultSize until then.
  size: number
  isOverridden: boolean
  handleProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  } | null
}

// A component's own size, defaulting to whatever its computed layer-driven
// value is until the user drags a handle — the same broadcast-and-locally-
// own pattern layer/direction/collapsed already use, just for size. Any
// component (Secondary or a Primary) that wants to be user-resizable uses
// this the same way, rather than each one growing its own bespoke drag
// state.
export function useOwnedSize<T extends HTMLElement>(
  defaultSize: number,
  { axis, min, enabled }: UseOwnedSizeOptions,
): OwnedSize<T> {
  const ref = useRef<T>(null)
  const [override, setOverride] = useState<number | null>(null)
  const dragStateRef = useRef<{ startPos: number; startSize: number } | null>(null)

  // If the floor moves (e.g. content changed) and the current override now
  // falls below it, re-clamp rather than leave a stale, out-of-range size.
  useEffect(() => {
    setOverride((previous) => (previous === null ? previous : Math.max(min, previous)))
  }, [min])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !ref.current) return
      // A resize handle can end up nested inside an ancestor's own drag
      // surface (e.g. a resizable nested Secondary's handle sits inside
      // the root Secondary's reorderable item wrapper) — without this,
      // the pointerdown also bubbles up and the ancestor's handler steals
      // pointer capture for itself, breaking the drag entirely.
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = ref.current.getBoundingClientRect()
      dragStateRef.current = {
        startPos: axis === 'x' ? event.clientX : event.clientY,
        startSize: axis === 'x' ? rect.width : rect.height,
      }
    },
    [enabled, axis],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragStateRef.current) return
      event.stopPropagation()
      const pos = axis === 'x' ? event.clientX : event.clientY
      const raw = dragStateRef.current.startSize + (pos - dragStateRef.current.startPos)
      setOverride(Math.max(min, raw))
    },
    [axis, min],
  )

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return {
    ref,
    size: override ?? defaultSize,
    isOverridden: override !== null,
    handleProps: enabled
      ? {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
        }
      : null,
  }
}
