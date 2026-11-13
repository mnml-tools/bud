import { createPortal } from 'react-dom'
import type { Branch } from '../../types/git'
import { useContextMenu } from '../../hooks/useContextMenu'

type Props = {
  branch: Branch
  currentBranch: string
  x: number
  y: number
  trigger: HTMLButtonElement
  busy: boolean
  onDismiss: () => void
  onAction: (action: 'checkout' | 'new' | 'delete' | 'merge') => void
}

export function BranchContextMenu({ branch, currentBranch, x, y, trigger, busy, onDismiss, onAction }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Branch actions: ${branch.name}`}
      className="git-file-context-menu git-branch-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 268)),
        top: Math.max(4, Math.min(y, window.innerHeight - 150))
      }}
    >
      {!branch.current && (
        <button role="menuitem" title={`Change to ${branch.name}`} disabled={busy} onClick={() => onAction('checkout')}>
          <span>
            Change to <span className="git-menu-branch-name">{branch.name}</span>
          </span>
        </button>
      )}
      <button role="menuitem" disabled={busy} onClick={() => onAction('new')}>
        New branch
      </button>
      {!branch.current && (
        <button role="menuitem" title={`Merge into ${currentBranch}`} disabled={busy} onClick={() => onAction('merge')}>
          <span>
            Merge into <span className="git-menu-branch-name">{currentBranch}</span>
          </span>
        </button>
      )}
      <button
        role="menuitem"
        className="git-discard-action"
        disabled={busy || branch.current}
        onClick={() => onAction('delete')}
      >
        Delete branch
      </button>
    </div>,
    document.body
  )
}
