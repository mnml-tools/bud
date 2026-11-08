import { useEffect, useRef } from 'react'

export function useContextMenu(onDismiss: () => void, trigger?: HTMLElement) {
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()

    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger?.contains(event.target as Node)) onDismiss()
    }

    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault()
        onDismiss()
        trigger?.focus()
      }
    }

    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', onDismiss)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('scroll', onDismiss, true)

    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', key)
      window.removeEventListener('blur', onDismiss)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
    }
  }, [onDismiss, trigger])

  return menu
}
