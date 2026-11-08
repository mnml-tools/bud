import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

const storageKey = 'bud.changesSplitPercent'
const clamp = (value: number) => Math.min(90, Math.max(10, value))

export function useChangesSplitResize() {
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; y: number; ratio: number; height: number } | null>(null)
  const [ratio, setRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null && saved.trim() && Number.isFinite(Number(saved))) return clamp(Number(saved))
    } catch {}

    return 50
  })
  const [dragging, setDragging] = useState(false)

  const resize = (next: number) => {
    const value = clamp(next)
    setRatio(value)
    try {
      localStorage.setItem(storageKey, String(value))
    } catch {}
  }

  const finish = () => {
    drag.current = null
    setDragging(false)
    document.documentElement.classList.remove('changes-resizing')
  }

  useEffect(() => () => document.documentElement.classList.remove('changes-resizing'), [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || !container.current) return

    event.preventDefault()
    event.currentTarget.focus()
    drag.current = {
      pointerId: event.pointerId,
      y: event.clientY,
      ratio,
      height: Math.max(1, container.current.clientHeight - 5)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    document.documentElement.classList.add('changes-resizing')
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (start?.pointerId === event.pointerId) resize(start.ratio + ((event.clientY - start.y) / start.height) * 100)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return

    finish()
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2
    if (event.key === 'ArrowUp') resize(ratio - step)
    else if (event.key === 'ArrowDown') resize(ratio + step)
    else if (event.key === 'Home') resize(10)
    else if (event.key === 'End') resize(90)
    else return

    event.preventDefault()
  }

  return {
    container,
    ratio,
    dragging,
    reset: () => resize(50),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown
    }
  }
}
