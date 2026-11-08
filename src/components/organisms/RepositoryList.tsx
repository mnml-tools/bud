import { useState } from 'react'
import { ArrowUpRight, FolderOpen, GitFork, LayoutGrid, List, Palette, Search, X } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { Button } from '../atoms/Button'
import { RepositoryAvatar } from '../atoms/RepositoryAvatar'
import { RepositoryAvatarPicker } from '../molecules/RepositoryAvatarPicker'
import { GitDialog } from '../molecules/GitDialog'
import { repositoryColor } from '../../lib/repositoryAvatar'
import { formatShortcut } from '../../lib/shortcuts'

export function RepositoryList({
  workspace,
  onClone,
  onOpen
}: {
  workspace: GitWorkspace
  onClone: () => void
  onOpen: () => void
}) {
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('bud.repositoryView') === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const edited = workspace.saved.find((repo) => repo.path === editing)
  const repositories = workspace.saved
    .filter((repo) => `${repo.name} ${repo.path}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  const changeView = (next: 'grid' | 'list') => {
    setView(next)
    try {
      localStorage.setItem('bud.repositoryView', next)
    } catch {}
  }
  const actions = (
    <>
      <Button disabled={!!workspace.busy} onClick={onOpen}>
        <FolderOpen size={14} />
        Open repository
      </Button>
      <Button disabled={!!workspace.busy} onClick={onClone}>
        <GitFork size={14} />
        Clone repository
      </Button>
    </>
  )

  if (!workspace.saved.length)
    return (
      <main className="git-home">
        <section className="git-welcome">
          <p>
            Open a local project or clone something new.
            <br />
            Your branches, commits, and next idea—all in one place.
          </p>
          <div className="git-home-actions">
            <Button className="primary" disabled={!!workspace.busy} onClick={onOpen}>
              <FolderOpen size={15} />
              Open repository <kbd>{formatShortcut({ key: 'o', primary: true })}</kbd>
            </Button>
            <Button disabled={!!workspace.busy} onClick={onClone}>
              <GitFork size={15} />
              Clone repository
            </Button>
          </div>
        </section>
      </main>
    )

  return (
    <main className="git-repositories">
      <div className="git-repositories-actions">
        <strong>Repositories</strong>
        <div>{actions}</div>
      </div>
      <div className="git-repositories-toolbar">
        <label className="git-repository-search">
          <Search size={14} />
          <input
            aria-label="Find a repository"
            placeholder="Find a repository…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span>
          {workspace.saved.length} saved {workspace.saved.length === 1 ? 'repository' : 'repositories'}
        </span>
        <div className="view-switch repository-view-switch" role="group" aria-label="Repository view">
          <Button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
            <List size={13} />
            List
          </Button>
          <Button type="button" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}>
            <LayoutGrid size={13} />
            Grid
          </Button>
        </div>
      </div>
      <div className={`git-repository-items git-repository-${view}`}>
        {repositories.map((repo) => (
          <article className="git-repository-card" key={repo.path}>
            <Button
              className="git-repository-main"
              disabled={!!workspace.busy}
              onClick={() => void workspace.open(repo.path)}
              aria-label={`Open ${repo.name}`}
            >
              <RepositoryAvatar repository={repo} />
              <span className="git-repository-info">
                <strong>{repo.name}</strong>
                <small title={repo.path}>{repo.path}</small>
              </span>
              <span className="git-repository-badge">Git</span>
              <ArrowUpRight size={16} className="git-repository-arrow" />
            </Button>
            <div className="git-repository-card-actions">
              <Button
                title="Change avatar colour"
                aria-label={`Change colour for ${repo.name}`}
                disabled={!!workspace.busy}
                onClick={() => setEditing(repo.path)}
              >
                <Palette size={12} />
              </Button>
              <Button
                title="Remove from saved repositories (files are kept)"
                aria-label={`Forget ${repo.name}`}
                disabled={!!workspace.busy}
                onClick={() => workspace.forget(repo.path)}
              >
                <X size={12} />
              </Button>
            </div>
          </article>
        ))}
        {!repositories.length && <p className="git-no-repositories">No repositories match your search.</p>}
      </div>
      {edited && (
        <GitDialog title={`Avatar colour · ${edited.name}`} onDismiss={() => setEditing(null)}>
          <div className="git-repository-colour">
            <RepositoryAvatarPicker
              name={edited.name}
              value={repositoryColor(edited)}
              onChange={(color) => workspace.setRepositoryColor(edited.path, color)}
            />
          </div>
          <div className="discard-actions">
            <Button onClick={() => setEditing(null)}>Done</Button>
          </div>
        </GitDialog>
      )}
    </main>
  )
}
