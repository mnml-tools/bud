import { useEffect, useRef } from 'react'
import type { Shortcut } from '../lib/shortcuts'
import { registerShortcut } from '../services/shortcuts'

export function useShortcut(shortcut: Shortcut, enabled: boolean, run: () => void) {
  const current = useRef({ enabled, run })
  current.current = { enabled, run }

  useEffect(
    () =>
      registerShortcut({
        shortcut,
        enabled: () => current.current.enabled,
        run: () => current.current.run()
      }),
    [shortcut]
  )
}
