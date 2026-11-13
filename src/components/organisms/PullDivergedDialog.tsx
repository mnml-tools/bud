import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { Button } from '../atoms/Button'
import { GitDialog } from '../molecules/GitDialog'

export function PullDivergedDialog({ workspace, onDismiss }: { workspace: GitWorkspace; onDismiss: () => void }) {
  const busy = !!workspace.busy

  const pull = async (action: 'pull-merge' | 'pull-rebase') => {
    if (busy) return

    await workspace.remoteAction(action)
    onDismiss()
  }

  return (
    <GitDialog title="Pull diverged branches?" busy={busy} onDismiss={onDismiss}>
      <p>
        <strong>{workspace.repository!.currentBranch}</strong> and origin have different commits. Choose how to combine
        them.
      </p>
      <p>
        <strong>Merge</strong> keeps your existing commits and creates a merge commit joining both histories.
      </p>
      <p>
        <strong>Rebase</strong> replays your local commits on top of origin’s commits for a linear history. This changes
        their commit IDs.
      </p>
      <p className="git-hint">Either option may require resolving conflicts.</p>
      <div className="discard-actions">
        <Button disabled={busy} onClick={onDismiss}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={() => void pull('pull-rebase')}>
          Rebase
        </Button>
        <Button className="primary" disabled={busy} onClick={() => void pull('pull-merge')}>
          Merge
        </Button>
      </div>
    </GitDialog>
  )
}
