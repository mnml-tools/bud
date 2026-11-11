import { createPortal } from 'react-dom'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  hash: string
  x: number
  y: number
  trigger: HTMLButtonElement
  busy: boolean
  isHead: boolean
  onDismiss: () => void
  onCheckout: () => void
  onNewTag: () => void
}

export function CommitContextMenu({ hash, x, y, trigger, busy, isHead, onDismiss, onCheckout, onNewTag }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Commit actions: ${hash.slice(0, 7)}`}
      className="git-file-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 208)),
        top: Math.max(4, Math.min(y, window.innerHeight - 84))
      }}
    >
      <button role="menuitem" disabled={busy || isHead} onClick={onCheckout}>
        Checkout commit
      </button>
      <button role="menuitem" disabled={busy} onClick={onNewTag}>
        New tag
      </button>
    </div>,
    document.body
  )
}
