import { Copy, Minus, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'
import { Button } from '../atoms/Button'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const window = getCurrentWindow()
    let disposed = false

    const update = () =>
      window
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value)
        })
        .catch(console.error)

    void update()
    const subscription = window.onResized(update)

    return () => {
      disposed = true
      void subscription.then((unlisten) => unlisten()).catch(console.error)
    }
  }, [])

  const toggleLabel = maximized ? 'Restore window' : 'Maximize window'

  return (
    <div className="window-controls" role="group" aria-label="Window controls">
      <Button
        type="button"
        title="Minimize window"
        aria-label="Minimize window"
        onClick={() => {
          void getCurrentWindow().minimize().catch(console.error)
        }}
      >
        <Minus size={14} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        title={toggleLabel}
        aria-label={toggleLabel}
        onClick={() => {
          void getCurrentWindow().toggleMaximize().catch(console.error)
        }}
      >
        {maximized ? <Copy size={13} aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}
      </Button>
      <Button
        type="button"
        className="window-close"
        title="Close window"
        aria-label="Close window"
        onClick={() => {
          void getCurrentWindow().close().catch(console.error)
        }}
      >
        <X size={15} aria-hidden="true" />
      </Button>
    </div>
  )
}
