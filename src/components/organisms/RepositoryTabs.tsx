import { useCallback, useId, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { RepositoryAvatar } from '../atoms/RepositoryAvatar'
import { RepositorySelectorMenu } from '../molecules/RepositorySelectorMenu'

export function RepositoryTabs({
  workspace,
  onOpenLocal,
  onClone
}: {
  workspace: GitWorkspace
  onOpenLocal: () => void
  onClone: () => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const dismiss = useCallback(() => setOpen(false), [])
  const busy = !!workspace.busy
  const available = workspace.saved
    .filter((item) => !workspace.openedRepositories.some((repo) => repo.path === item.path))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

  return (
    <div className="tabs repository-tabs" aria-label="Open repositories">
      {workspace.openedRepositories.map((repo) => (
        <div className={`tab${workspace.repository?.path === repo.path ? ' active' : ''}`} key={repo.path}>
          <button
            disabled={busy}
            title={repo.path}
            aria-current={workspace.repository?.path === repo.path ? 'page' : undefined}
            onClick={() => void workspace.open(repo.path)}
          >
            <RepositoryAvatar repository={workspace.saved.find((item) => item.path === repo.path) ?? repo} />
            {repo.name}
          </button>
          <button
            disabled={busy}
            title={`Close ${repo.name}`}
            aria-label={`Close ${repo.name}`}
            onClick={() => workspace.closeTab(repo.path)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        ref={trigger}
        className="repository-tab-add"
        disabled={busy}
        title="Open repository in a tab"
        aria-label="Open repository in a tab"
        aria-haspopup="dialog"
        aria-expanded={open && !busy}
        aria-controls={open && !busy ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} />
      </button>
      {open && !busy && trigger.current && (
        <RepositorySelectorMenu
          id={id}
          repository={workspace.repository ?? { path: '', name: '' }}
          repositories={available}
          trigger={trigger.current}
          onDismiss={dismiss}
          onSelect={(repo) => void workspace.open(repo.path)}
          onOpenLocal={onOpenLocal}
          onClone={onClone}
          label="Open repository"
          emptyMessage="All saved repositories are already open."
        />
      )}
    </div>
  )
}
