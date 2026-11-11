import { useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowDownToLine,
  CloudDownload,
  ArrowUpFromLine,
  GitBranch,
  GitFork,
  RefreshCw,
  GitCommitHorizontal,
  Files
} from 'lucide-react'
import type { GitWorkspace } from '../hooks/useGitWorkspace'
import { useShortcut } from '../hooks/useShortcut'
import { findCommitsShortcut, refreshRepositoryShortcut, searchCommitsShortcut, formatShortcut } from '../lib/shortcuts'
import { getShortcuts, subscribeShortcuts, resolveShortcut } from '../services/shortcutPreferences'
import { Button } from '../components/atoms/Button'
import { GitDialog } from '../components/molecules/GitDialog'
import { GitBranchSidebar } from '../components/organisms/GitBranchSidebar'
import { CommitHistory } from '../components/organisms/CommitHistory'
import { RepositoryChanges } from '../components/organisms/RepositoryChanges'

export function GitWorkspacePage({
  workspace,
  onClone,
  onOpenAiSettings
}: {
  workspace: GitWorkspace
  onClone: () => void
  onOpenAiSettings: () => void
}) {
  const repo = workspace.repository!
  useSyncExternalStore(subscribeShortcuts, getShortcuts)
  const [selected, setSelected] = useState('')
  const [showingChanges, setShowingChanges] = useState(false)
  const [push, setPush] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)
  const disabled = !!workspace.busy
  const incomingCommits = repo.branches.find((branch) => branch.current)?.incomingCommits ?? 0

  useShortcut(refreshRepositoryShortcut, !disabled, () => void workspace.refresh())
  useShortcut(searchCommitsShortcut, true, () => filterRef.current?.focus())
  useShortcut(findCommitsShortcut, true, () => filterRef.current?.focus())

  return (
    <>
      <div className="git-toolbar">
        <div className="git-view-switch" role="group" aria-label="Repository view">
          <Button
            aria-pressed={!showingChanges}
            onClick={() => {
              setShowingChanges(false)
              setSelected('')
            }}
          >
            <GitCommitHorizontal size={13} />
            Commit history
          </Button>
          <Button aria-pressed={showingChanges} onClick={() => setShowingChanges(true)}>
            <Files size={13} />
            All changes
            <span className={`git-push-badge${repo.changes?.length ? '' : ' neutral'}`}>
              {repo.changes?.length ?? 0}
            </span>
          </Button>
        </div>
        <div className="git-remote-actions">
          <Button
            disabled={disabled || !repo.remotes.includes('origin')}
            title="Check origin for updates without changing local files"
            onClick={() => void workspace.remoteAction('fetch')}
          >
            <CloudDownload size={13} />
            Fetch
          </Button>
          <Button
            disabled={disabled || !repo.remotes.includes('origin') || repo.currentBranch === 'Detached HEAD'}
            title="Apply changes from origin to the current branch (fast-forward only)"
            onClick={() => void workspace.remoteAction('pull')}
          >
            <ArrowDownToLine size={13} />
            Pull
            {incomingCommits > 0 && (
              <span className="git-push-badge" title={`${incomingCommits} commits to pull from origin`}>
                {incomingCommits}
              </span>
            )}
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
        <Button
          disabled={disabled}
          title={`Refresh · ${formatShortcut(resolveShortcut(refreshRepositoryShortcut))}`}
          onClick={() => void workspace.refresh()}
        >
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
          onSelect={(hash) => {
            setShowingChanges(false)
            setSelected(hash)
          }}
        />
        <div className="git-main">
          {showingChanges ? (
            <RepositoryChanges workspace={workspace} onOpenAiSettings={onOpenAiSettings} />
          ) : (
            <CommitHistory
              key={repo.path}
              history={workspace.history}
              loadDiff={workspace.commitDiff}
              githubRepo={repo.githubRepo ?? undefined}
              selected={selected}
              busy={disabled}
              onMore={() => void workspace.more()}
              onCreateTag={workspace.createTag}
              canPushTags={repo.remotes.includes('origin')}
              onCheckout={(hash) => void workspace.checkoutCommit(hash)}
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
