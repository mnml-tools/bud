import { useCallback, useState } from 'react'
import { GitBranch, GitCommitVertical, Cloud, Search, House, ChevronDown, ChevronRight, ArrowDown } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { ResizableSidebar } from './ResizableSidebar'
import { Button } from '../atoms/Button'
import type { Branch } from '../../types/git'
import { BranchContextMenu } from '../molecules/BranchContextMenu'
import { BranchActionDialog } from './BranchActionDialog'

export function GitBranchSidebar({
  workspace,
  selected,
  showingChanges,
  onSelect
}: {
  workspace: GitWorkspace
  selected: string
  showingChanges: boolean
  onSelect: (hash: string) => void
}) {
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ branch: Branch; x: number; y: number; trigger: HTMLButtonElement } | null>(null)
  const [action, setAction] = useState<{ branch: Branch; action: 'new' | 'delete' | 'merge' } | null>(null)
  const dismissMenu = useCallback(() => setMenu(null), [])
  const [expanded, setExpanded] = useState({ local: true, remote: false })
  const repo = workspace.repository!
  const detachedHead =
    repo.currentBranch === 'Detached HEAD'
      ? workspace.history.commits.find((commit) => commit.refs.split(', ').includes('HEAD'))
      : undefined

  return (
    <ResizableSidebar>
      <div className="git-sidebar-content">
        <div className="git-sidebar-title">
          <GitBranch size={14} />
          <strong>Branches</strong>
          <span>{repo.branches.length}</span>
        </div>
        <label className="git-branch-search">
          <Search size={13} />
          <input
            aria-label="Filter branches"
            placeholder="Find a branch…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {[false, true].map((remote) => {
          const group = remote ? 'remote' : 'local'
          const isExpanded = expanded[group]
          const branches = repo.branches
            .filter((branch) => branch.remote === remote && branch.name.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => Number(b.name === 'main') - Number(a.name === 'main') || a.name.localeCompare(b.name))

          return (
            <section className="git-branch-group" key={String(remote)}>
              <Button
                className="git-section-heading git-branch-toggle"
                aria-expanded={isExpanded}
                onClick={() => setExpanded((current) => ({ ...current, [group]: !current[group] }))}
              >
                <span>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {remote ? <Cloud size={12} /> : <House size={12} />}
                  {remote ? 'REMOTE' : 'LOCAL'}
                </span>
                <span>{branches.length}</span>
              </Button>
              {isExpanded && !remote && detachedHead && 'head'.includes(query.toLowerCase()) && (
                <div className="git-branch-row current">
                  <Button
                    title={`HEAD · ${detachedHead.hash.slice(0, 7)}`}
                    aria-pressed={!showingChanges && (!selected || selected === detachedHead.hash)}
                    onClick={() => onSelect(detachedHead.hash)}
                  >
                    <GitCommitVertical size={13} />
                    <span>HEAD</span>
                  </Button>
                </div>
              )}
              {isExpanded &&
                branches.length === 0 &&
                !(!remote && detachedHead && 'head'.includes(query.toLowerCase())) && (
                  <p className="git-sidebar-empty">
                    {query
                      ? 'No matching branches'
                      : remote
                        ? 'No remote branches. Try Fetch.'
                        : 'No local branches yet.'}
                  </p>
                )}
              {isExpanded &&
                branches.map((branch) => (
                  <div className={`git-branch-row${branch.current ? ' current' : ''}`} key={branch.name}>
                    <Button
                      title={`${branch.name} · ${branch.hash.slice(0, 7)}`}
                      aria-pressed={!showingChanges && selected === branch.hash}
                      onClick={() => onSelect(branch.hash)}
                      onDoubleClick={() => {
                        if (!remote && !branch.current && !workspace.busy) void workspace.checkout(branch.name)
                      }}
                      onContextMenu={(event) => {
                        if (remote) return
                        event.preventDefault()
                        setMenu({ branch, x: event.clientX, y: event.clientY, trigger: event.currentTarget })
                      }}
                      onKeyDown={(event) => {
                        if (!remote && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
                          event.preventDefault()
                          const rect = event.currentTarget.getBoundingClientRect()
                          setMenu({ branch, x: rect.left, y: rect.bottom, trigger: event.currentTarget })
                        }
                      }}
                    >
                      <GitBranch size={13} />
                      <span>{branch.name}</span>
                    </Button>
                    {!remote && (branch.incomingCommits ?? 0) > 0 && (
                      <span
                        className="git-branch-incoming"
                        title={`${branch.incomingCommits} commits to pull from origin/${branch.name}`}
                        aria-label={`${branch.incomingCommits} incoming commits`}
                      >
                        {branch.incomingCommits}
                        <ArrowDown size={12} />
                      </span>
                    )}
                  </div>
                ))}
            </section>
          )
        })}
      </div>
      {menu && (
        <BranchContextMenu
          {...menu}
          busy={!!workspace.busy}
          onDismiss={dismissMenu}
          onAction={(next) => {
            const branch = menu.branch
            setMenu(null)
            if (next === 'checkout') void workspace.checkout(branch.name)
            else setAction({ branch, action: next })
          }}
        />
      )}
      {action && <BranchActionDialog {...action} workspace={workspace} onDismiss={() => setAction(null)} />}
    </ResizableSidebar>
  )
}
