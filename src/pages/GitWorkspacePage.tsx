import { useRef, useState } from 'react'
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, GitBranch, GitFork, RefreshCw } from 'lucide-react'
import type { GitWorkspace } from '../hooks/useGitWorkspace'
import { useShortcut } from '../hooks/useShortcut'
import { findCommitsShortcut } from '../lib/shortcuts'
import { Button } from '../components/atoms/Button'
import { GitDialog } from '../components/molecules/GitDialog'
import { GitBranchSidebar } from '../components/organisms/GitBranchSidebar'
import { CommitHistory } from '../components/organisms/CommitHistory'
import { RepositoryChanges } from '../components/organisms/RepositoryChanges'

const refreshShortcut = { key: 'r', primary: true }
const findShortcut = { key: 'f', primary: true }

export function GitWorkspacePage({ workspace, onClone }: { workspace: GitWorkspace; onClone: () => void }) {
  const repo = workspace.repository!
  const [selected, setSelected] = useState('')
  const [showingChanges, setShowingChanges] = useState(false)
  const [push, setPush] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)
  const disabled = !!workspace.busy

  useShortcut(refreshShortcut, !disabled, () => void workspace.refresh())
  useShortcut(findShortcut, true, () => filterRef.current?.focus())
  useShortcut(findCommitsShortcut, true, () => filterRef.current?.focus())

  return (
    <>
      <div className="git-toolbar">
        <Button disabled={disabled} onClick={workspace.close} title="All repositories">
          <ArrowLeft size={14} />
        </Button>
        <div className="git-remote-actions">
          <Button disabled={disabled || !workspace.remote} onClick={() => void workspace.remoteAction('fetch')}>
            <ArrowDownToLine size={13} />
            Fetch
          </Button>
          <Button
            disabled={disabled || !workspace.remote || repo.currentBranch === 'Detached HEAD'}
            title="Pull current branch (fast-forward only)"
            onClick={() => void workspace.remoteAction('pull')}
          >
            <ArrowDownToLine size={13} />
            Pull
          </Button>
          <Button
            disabled={disabled || !workspace.remote || repo.currentBranch === 'Detached HEAD'}
            onClick={() => setPush(true)}
          >
            <ArrowUpFromLine size={13} />
            Push
            {!!repo.outgoingCommits?.[workspace.remote] && (
              <span className="git-push-badge" title={`${repo.outgoingCommits[workspace.remote]} commits to push`}>
                {repo.outgoingCommits[workspace.remote]}
              </span>
            )}
          </Button>
        </div>
        <div className="git-toolbar-spacer" />
        <span className="git-current-branch">
          <GitBranch size={13} />
          {repo.currentBranch}
        </span>
        <Button disabled={disabled} title="Refresh · ⌘/Ctrl+R" onClick={() => void workspace.refresh()}>
          <RefreshCw size={13} className={disabled ? 'git-spinning' : ''} />
        </Button>
        <Button disabled={disabled} onClick={onClone} title="Clone repository">
          <GitFork size={13} />
        </Button>
      </div>
      <div className="workspace-body git-workspace-body">
        <GitBranchSidebar
          workspace={workspace}
          selected={selected}
          showingChanges={showingChanges}
          onChanges={() => setShowingChanges(true)}
          onSelect={(hash) => {
            setShowingChanges(false)
            setSelected(hash)
          }}
        />
        <div className="git-main">
          {showingChanges ? (
            <RepositoryChanges workspace={workspace} />
          ) : (
            <CommitHistory
              key={repo.path}
              history={workspace.history}
              githubRepo={repo.githubRepo ?? undefined}
              selected={selected}
              busy={disabled}
              onMore={() => void workspace.more()}
              filterRef={filterRef}
            />
          )}
        </div>
      </div>
      {push && (
        <GitDialog title="Push branch?" onDismiss={() => setPush(false)} busy={disabled}>
          <p>
            Push <strong>{repo.currentBranch}</strong> to <strong>{workspace.remote}</strong> using{' '}
            <strong>{workspace.activeKey?.name ?? 'SSH config / agent'}</strong>?
          </p>
          <p className="git-hint">
            This publishes committed changes and sets the branch upstream. Uncommitted files stay local.
          </p>
          <div className="discard-actions">
            <Button disabled={disabled} onClick={() => setPush(false)}>
              Cancel
            </Button>
            <Button
              className="primary"
              disabled={disabled}
              onClick={async () => {
                if (await workspace.remoteAction('push')) setPush(false)
              }}
            >
              {disabled ? 'Pushing…' : 'Push branch'}
            </Button>
          </div>
        </GitDialog>
      )}
    </>
  )
}
