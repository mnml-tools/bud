import { createPortal } from 'react-dom'
import type { Branch } from '../../types/git'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  branch: Branch
  x: number
  y: number
  trigger: HTMLButtonElement
  busy: boolean
  onDismiss: () => void
  onAction: (action: 'checkout' | 'new' | 'delete' | 'merge') => void
}

export function BranchContextMenu({ branch, x, y, trigger, busy, onDismiss, onAction }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Branch actions: ${branch.name}`}
      className="git-file-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 208)),
        top: Math.max(4, Math.min(y, window.innerHeight - 150))
      }}
    >
      {!branch.current && (
        <button role="menuitem" disabled={busy} onClick={() => onAction('checkout')}>
          Change to
        </button>
      )}
      <button role="menuitem" disabled={busy} onClick={() => onAction('new')}>
        New branch
      </button>
      <button
        role="menuitem"
        className="git-discard-action"
        disabled={busy || branch.current}
        onClick={() => onAction('delete')}
      >
        Delete branch
      </button>
      {!branch.current && (
        <button role="menuitem" disabled={busy} onClick={() => onAction('merge')}>
          Merge branch
        </button>
      )}
    </div>,
    document.body
  )
}
