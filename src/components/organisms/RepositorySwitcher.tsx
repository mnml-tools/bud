import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'
import { RepositoryAvatar } from '../atoms/RepositoryAvatar'

export function RepositorySwitcher({ workspace, onDismiss }: { workspace: GitWorkspace; onDismiss: () => void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const id = useId()
  const busy = !!workspace.busy
  const repositories = useMemo(() => {
    const all = new Map([...workspace.openedRepositories, ...workspace.saved].map((repo) => [repo.path, repo]))
    const needle = query.trim().toLowerCase()

    return [...all.values()].filter(
      (repo) => repo.path !== workspace.repository?.path && `${repo.name} ${repo.path}`.toLowerCase().includes(needle)
    )
  }, [workspace.openedRepositories, workspace.saved, workspace.repository?.path, query])
  const selected = Math.min(cursor, Math.max(0, repositories.length - 1))

  const open = async (path: string) => {
    if (await workspace.open(path)) onDismiss()
  }

  return (
    <GitDialog title="Switch repository" className="git-repository-switcher" busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && repositories[selected]) void open(repositories[selected].path)
        }}
      >
        <div className="repository-selector-menu-heading">
          <span>Switch repository</span>
          <span>{repositories.length} available</span>
        </div>
        <label className="git-switcher-search">
          <Search size={15} aria-hidden="true" />
          <input
            role="combobox"
            aria-label="Find a repository to switch to"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={id}
            aria-activedescendant={repositories[selected] ? `${id}-${selected}` : undefined}
            placeholder="Search repositories…"
            value={query}
            disabled={busy}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const next = repositories.length
                ? (selected + (event.key === 'ArrowDown' ? 1 : -1) + repositories.length) % repositories.length
                : 0
              setCursor(next)
              document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: 'nearest' })
            }}
          />
        </label>
        <div className="git-switcher-results" role="listbox" aria-label="Other repositories" id={id}>
          {repositories.map((repo, index) => (
            <Button
              className="repository-selector-option"
              type="button"
              role="option"
              tabIndex={-1}
              onPointerMove={() => setCursor(index)}
              onMouseDown={(event) => event.preventDefault()}
              aria-selected={selected === index}
              id={`${id}-${index}`}
              key={repo.path}
              disabled={busy}
              onClick={() => void open(repo.path)}
              onFocus={() => setCursor(index)}
            >
              <RepositoryAvatar repository={repo} />
              <span className="repository-selector-details">
                <strong>{repo.name}</strong>
                <span>{repo.path}</span>
              </span>
            </Button>
          ))}
        </div>
        {!repositories.length && (
          <p className="git-hint">
            {query ? 'No matching repositories.' : 'No other repositories yet. Open a folder to add one.'}
          </p>
        )}
        <div className="repository-selector-menu-footer">Switch repositories without changing files</div>
      </form>
    </GitDialog>
  )
}
