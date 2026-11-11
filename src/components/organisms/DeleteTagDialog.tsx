import { useState } from 'react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

export function DeleteTagDialog({
  workspace,
  name,
  onDismiss
}: {
  workspace: GitWorkspace
  name: string
  onDismiss: () => void
}) {
  const [deleteOrigin, setDeleteOrigin] = useState(false)
  const busy = !!workspace.busy

  return (
    <GitDialog title="Delete tag?" busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!busy && (await workspace.deleteTag(name, deleteOrigin))) onDismiss()
        }}
      >
        <p>
          Delete local tag <strong>{name}</strong>?
        </p>
        {workspace.repository!.remotes.includes('origin') && (
          <label className="git-delete-origin-option">
            <input
              type="checkbox"
              checked={deleteOrigin}
              disabled={busy}
              onChange={(event) => setDeleteOrigin(event.target.checked)}
            />
            <span>Also delete origin tag</span>
          </label>
        )}
        <div className="discard-actions">
          <Button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
          <Button type="submit" className="git-discard-action" disabled={busy}>
            Delete tag
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
