import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playFlip } from './motion'

function rect(left: number, top: number): DOMRect {
  return { left, top, right: left + 100, bottom: top + 40, width: 100, height: 40 } as DOMRect
}

describe('playFlip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('synchronously snaps the element back to its old visual position with no transition, before releasing it into a transitioned glide next frame', () => {
    const el = document.createElement('div')
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(0, 0))

    playFlip(el, rect(50, 20), 150)

    // The "invert" step: transform reflects the old-minus-new delta,
    // transition explicitly disabled so this doesn't itself animate.
    expect(el.style.transition).toBe('none')
    expect(el.style.transform).toBe('translate(50px, 20px)')

    vi.runAllTimers()

    // The "play" step, one frame later: a real transition is turned on and
    // the transform is released back to identity, so the browser animates
    // the glide from the inverted position to the real one.
    expect(el.style.transition).toBe('transform 150ms ease-out')
    expect(el.style.transform).toBe('')
  })

  it('does nothing when the element never actually moved', () => {
    const el = document.createElement('div')
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(50, 20))

    playFlip(el, rect(50, 20), 150)

    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
  })
})
