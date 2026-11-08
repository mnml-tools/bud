import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../hooks/useTheme'
import { accents, modes } from '../../services/theme'
import { isDialogBackdropClick } from '../../lib/dialog'
import { Button } from '../atoms/Button'

export function AppearanceDialog({ onDismiss }: { onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const { theme, accent, setTheme, setAccent } = useTheme()

  useEffect(() => {
    const element = dialog.current!
    element.showModal()

    return () => element.close()
  }, [])

  return createPortal(
    <dialog
      ref={dialog}
      className="modal error-dialog appearance-dialog"
      aria-labelledby={title}
      onClick={(event) => {
        if (isDialogBackdropClick(event)) onDismiss()
      }}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    >
      <div className="modal-heading">
        <h2 id={title}>Appearance</h2>
      </div>
      <div className="appearance-options">
        <div>Colour mode</div>
        <div className="view-switch appearance-modes" role="group" aria-label="Colour mode">
          {modes.map((mode) => (
            <Button key={mode} type="button" aria-pressed={mode === theme} onClick={() => setTheme(mode)}>
              {mode}
            </Button>
          ))}
        </div>
        <div>Accent colour</div>
        <div className="appearance-accents" role="group" aria-label="Accent colour">
          {accents.map((colour) => (
            <Button
              key={colour}
              type="button"
              data-swatch={colour}
              aria-pressed={colour === accent}
              onClick={() => setAccent(colour)}
            >
              <span className="appearance-swatch" aria-hidden="true" />
              {colour}
            </Button>
          ))}
        </div>
      </div>
      <div className="discard-actions">
        <Button type="button" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </dialog>,
    document.body
  )
}
