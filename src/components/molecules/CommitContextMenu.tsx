import { createPortal } from 'react-dom'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  hash: string
  x: number
  y: number
  trigger: HTMLButtonElement
  disabled: boolean
  onDismiss: () => void
  onCheckout: () => void
}

export function CommitContextMenu({ hash, x, y, trigger, disabled, onDismiss, onCheckout }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Commit actions: ${hash.slice(0, 7)}`}
      className="git-file-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 208)),
        top: Math.max(4, Math.min(y, window.innerHeight - 70))
      }}
    >
      <button role="menuitem" disabled={disabled} onClick={onCheckout}>
        Checkout commit
      </button>
      <span className="git-hint">Switches to detached HEAD</span>
    </div>,
    document.body
  )
}
