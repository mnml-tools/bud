import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  x: number
  y: number
  staged: boolean
  count: number
  busy: boolean
  trigger: HTMLButtonElement
  onDismiss: () => void
  onAction: (action: 'stage' | 'unstage' | 'discard') => void
}

export function ChangeContextMenu({ x, y, staged, count, busy, trigger, onDismiss, onAction }: Props) {
  const dismiss = useCallback(onDismiss, [onDismiss])
  const menu = useContextMenu(dismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label="File actions"
      className="git-file-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 208)),
        top: Math.max(4, Math.min(y, window.innerHeight - 90))
      }}
    >
      <button role="menuitem" disabled={busy} onClick={() => onAction(staged ? 'unstage' : 'stage')}>
        {staged ? 'Unstage' : 'Stage'} {count > 1 ? `${count} files` : 'file'}
      </button>
      <button role="menuitem" className="git-discard-action" disabled={busy} onClick={() => onAction('discard')}>
        Discard changes{count > 1 ? ` (${count} files)` : ''}
      </button>
    </div>,
    document.body
  )
}
