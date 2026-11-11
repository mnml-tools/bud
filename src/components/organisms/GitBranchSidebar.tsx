import { useCallback, useState } from 'react'
import {
  Tag,
  GitBranch,
  GitCommitVertical,
  LoaderCircle,
  Cloud,
  Search,
  House,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  ArrowDown
} from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { ResizableSidebar } from './ResizableSidebar'
import { Button } from '../atoms/Button'
import type { Branch } from '../../types/git'
import { BranchContextMenu } from '../molecules/BranchContextMenu'
import { BranchActionDialog } from './BranchActionDialog'
import { TagContextMenu } from '../molecules/TagContextMenu'
import { DeleteTagDialog } from './DeleteTagDialog'

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
  const [tagMenu, setTagMenu] = useState<{ name: string; x: number; y: number; trigger: HTMLButtonElement } | null>(
    null
  )
  const dismissTagMenu = useCallback(() => setTagMenu(null), [])
  const [deletingTag, setDeletingTag] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ branch: Branch; x: number; y: number; trigger: HTMLButtonElement } | null>(null)
  const [action, setAction] = useState<{ branch: Branch; action: 'new' | 'delete' | 'merge' } | null>(null)
  const dismissMenu = useCallback(() => setMenu(null), [])
  const [expanded, setExpanded] = useState({ local: true, remote: false, tags: false })
  const repo = workspace.repository!
  const tags = (repo.tags ?? []).filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
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
            aria-label="Filter branches and tags"
            placeholder="Find a branch or tag…"
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
                  <div
                    className={`git-branch-row${(!branch.remote && workspace.switchingBranch ? workspace.switchingBranch === branch.name : branch.current) ? ' current' : ''}`}
                    key={branch.name}
                  >
                    <Button
                      aria-busy={!remote && workspace.switchingBranch === branch.name}
                      title={`${branch.name} · ${branch.hash.slice(0, 7)}`}
                      aria-pressed={!showingChanges && selected === branch.hash}
                      onClick={() => onSelect(branch.hash)}
                      onDoubleClick={() => {
                        if (!remote && !branch.current && !workspace.busy) void workspace.checkout(branch.name)
                      }}
                      onContextMenu={(event) => {
                        if (remote) return
                        event.preventDefault()
                        setTagMenu(null)
                        setMenu({ branch, x: event.clientX, y: event.clientY, trigger: event.currentTarget })
                      }}
                      onKeyDown={(event) => {
                        if (!remote && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
                          event.preventDefault()
                          const rect = event.currentTarget.getBoundingClientRect()
                          setTagMenu(null)
                          setMenu({ branch, x: rect.left, y: rect.bottom, trigger: event.currentTarget })
                        }
                      }}
                    >
                      {!remote && workspace.switchingBranch === branch.name ? (
                        <LoaderCircle size={13} className="git-spinning" aria-label="Switching branch" />
                      ) : (
                        <GitBranch size={13} />
                      )}
                      <span>{branch.name}</span>
                    </Button>
                    {!remote && branch.upstreamGone && (
                      <span
                        className="git-branch-warning"
                        aria-label="Tracked remote branch no longer exists"
                        role="img"
                        tabIndex={0}
                      >
                        <TriangleAlert size={13} aria-hidden="true" />
                        <span className="git-branch-warning-tooltip" role="tooltip">
                          The tracked remote branch no longer exists.
                        </span>
                      </span>
                    )}
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
        <section className="git-branch-group">
          <Button
            className="git-section-heading git-branch-toggle"
            aria-expanded={expanded.tags}
            onClick={() => setExpanded((current) => ({ ...current, tags: !current.tags }))}
          >
            <span>
              {expanded.tags ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Tag size={12} />
              TAGS
            </span>
            <span>{tags.length}</span>
          </Button>
          {expanded.tags && tags.length === 0 && (
            <p className="git-sidebar-empty">{query ? 'No matching tags' : 'No tags yet.'}</p>
          )}
          {expanded.tags &&
            tags.map((tag) => (
              <div className="git-branch-row git-tag-row" key={tag.name}>
                <Button
                  title={`${tag.name} · ${tag.hash.slice(0, 7)}`}
                  aria-pressed={!showingChanges && selected === tag.hash}
                  onClick={() => onSelect(tag.hash)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMenu(null)
                    setTagMenu({ name: tag.name, x: event.clientX, y: event.clientY, trigger: event.currentTarget })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                      event.preventDefault()
                      const rect = event.currentTarget.getBoundingClientRect()
                      setMenu(null)
                      setTagMenu({ name: tag.name, x: rect.left, y: rect.bottom, trigger: event.currentTarget })
                    }
                  }}
                >
                  <Tag size={13} />
                  <span>{tag.name}</span>
                </Button>
              </div>
            ))}
        </section>
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
      {tagMenu && (
        <TagContextMenu
          {...tagMenu}
          canPush={repo.remotes.includes('origin')}
          onPush={() => {
            const name = tagMenu.name
            setTagMenu(null)
            void workspace.pushTag(name)
          }}
          busy={!!workspace.busy}
          onDismiss={dismissTagMenu}
          onDelete={() => {
            setDeletingTag(tagMenu.name)
            setTagMenu(null)
          }}
        />
      )}
      {deletingTag !== null && (
        <DeleteTagDialog workspace={workspace} name={deletingTag} onDismiss={() => setDeletingTag(null)} />
      )}
      {action && <BranchActionDialog {...action} workspace={workspace} onDismiss={() => setAction(null)} />}
    </ResizableSidebar>
  )
}
