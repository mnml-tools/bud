import { useState } from 'react'
import type { Commit } from '../../types/git'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

export function NewTagDialog({
  commit,
  busy,
  canPush,
  onCreate,
  onDismiss
}: {
  commit: Commit
  busy: boolean
  canPush: boolean
  onCreate: (hash: string, name: string, pushOrigin: boolean) => Promise<boolean>
  onDismiss: () => void
}) {
  const [name, setName] = useState('')
  const [pushOrigin, setPushOrigin] = useState(false)

  return (
    <GitDialog title="New tag" busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!busy && name.trim() && (await onCreate(commit.hash, name.trim(), pushOrigin))) onDismiss()
        }}
      >
        <p>
          <code>{commit.hash.slice(0, 7)}</code> · {commit.subject}
        </p>
        <label>
          Tag name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            required
            autoComplete="off"
          />
        </label>
        <label className="git-delete-origin-option">
          <input
            type="checkbox"
            checked={pushOrigin}
            disabled={busy || !canPush}
            onChange={(event) => setPushOrigin(event.target.checked)}
          />
          <span>Also push to origin</span>
        </label>
        <div className="discard-actions">
          <Button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
          <Button type="submit" className="primary" disabled={busy || !name.trim()}>
            Create tag
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
