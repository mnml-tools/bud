import { useState } from 'react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import type { Branch } from '../../types/git'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

export function BranchActionDialog({
  workspace,
  branch,
  action,
  onDismiss
}: {
  workspace: GitWorkspace
  branch: Branch
  action: 'new' | 'delete' | 'merge'
  onDismiss: () => void
}) {
  const [name, setName] = useState('')
  const [deleteOrigin, setDeleteOrigin] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState<'unmerged' | 'other' | null>(null)
  const title = { new: 'New branch', delete: 'Delete branch?', merge: 'Merge branch?' }[action]
  const busy = !!workspace.busy
  const canForceDelete =
    action === 'delete' &&
    deleteFailure !== null &&
    workspace.repository!.branches.some((item) => !item.remote && !item.current && item.name === branch.name)

  const submit = async (force = false) => {
    if (busy || (action === 'new' && !name.trim()) || (force && !canForceDelete)) return

    const result = await workspace.branchAction(branch.name, force ? 'force-delete' : action, name.trim(), deleteOrigin)
    if (result === true) onDismiss()
    else if (action === 'delete' && !force) setDeleteFailure(result === 'unmerged' ? 'unmerged' : 'other')
  }

  return (
    <GitDialog title={title} busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {action === 'new' ? (
          <>
            <p>
              Create and switch to a new branch from <strong>{branch.name}</strong>.
            </p>
            <label className="git-new-branch-label">
              Branch name
              <input
                aria-label="Branch name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
                autoComplete="off"
                required
              />
            </label>
          </>
        ) : action === 'delete' ? (
          <>
            <p>
              Delete local branch <strong>{branch.name}</strong>?
            </p>
            {canForceDelete && (
              <p role="alert">
                {deleteFailure === 'unmerged' ? 'This branch contains unmerged commits. ' : ''}
                Force deleting the local branch may make unmerged commits unreachable.
              </p>
            )}
            {workspace.repository!.remotes.includes('origin') && (
              <label className="git-delete-origin-option">
                <input
                  type="checkbox"
                  checked={deleteOrigin}
                  disabled={busy}
                  onChange={(event) => setDeleteOrigin(event.target.checked)}
                />
                <span>Also delete origin branch</span>
              </label>
            )}
          </>
        ) : (
          <p>
            Merge <strong>{branch.name}</strong> into <strong>{workspace.repository!.currentBranch}</strong>?
          </p>
        )}
        <div className="discard-actions">
          <Button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            type="submit"
            className={action === 'delete' ? 'git-discard-action' : 'primary'}
            disabled={busy || (action === 'new' && !name.trim())}
          >
            {action === 'new' ? 'Create branch' : action === 'delete' ? 'Delete branch' : 'Merge branch'}
          </Button>
          {canForceDelete && (
            <Button type="button" className="git-discard-action" disabled={busy} onClick={() => void submit(true)}>
              Force delete
            </Button>
          )}
        </div>
      </form>
    </GitDialog>
  )
}
