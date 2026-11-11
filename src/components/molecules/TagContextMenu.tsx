import { createPortal } from 'react-dom'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  name: string
  x: number
  y: number
  trigger: HTMLButtonElement
  busy: boolean
  onDismiss: () => void
  onPush: () => void
  canPush: boolean
  onDelete: () => void
}

export function TagContextMenu({ name, x, y, trigger, busy, onDismiss, onDelete, onPush, canPush }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Tag actions: ${name}`}
      className="git-file-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 208)),
        top: Math.max(4, Math.min(y, window.innerHeight - 84))
      }}
    >
      <button role="menuitem" disabled={busy || !canPush} onClick={onPush}>
        Push to origin
      </button>
      <button role="menuitem" className="git-discard-action" disabled={busy} onClick={onDelete}>
        Delete tag
      </button>
    </div>,
    document.body
  )
}
