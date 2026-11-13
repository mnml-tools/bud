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
  const [forceDelete, setForceDelete] = useState(false)
  const title = { new: 'New branch', delete: 'Delete branch?', merge: 'Merge branch?' }[action]
  const busy = !!workspace.busy

  return (
    <GitDialog title={forceDelete ? 'Force delete branch?' : title} busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy || (action === 'new' && !name.trim())) return

          const result = await workspace.branchAction(
            branch.name,
            forceDelete ? 'force-delete' : action,
            name.trim(),
            deleteOrigin
          )
          if (result === 'unmerged') setForceDelete(true)
          else if (result) onDismiss()
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
              {forceDelete ? (
                <>
                  Branch <strong>{branch.name}</strong> contains unmerged commits. Force deleting it removes the branch
                  reference, and those commits may become unreachable. Delete it anyway?
                </>
              ) : (
                <>
                  Delete local branch <strong>{branch.name}</strong>?
                </>
              )}
            </p>
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
            {action === 'new'
              ? 'Create branch'
              : action === 'delete'
                ? forceDelete
                  ? 'Force delete'
                  : 'Delete branch'
                : 'Merge branch'}
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
