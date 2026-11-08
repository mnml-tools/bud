import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import type { GitRequest } from '../../services/git'
import { nextRepositoryColor } from '../../lib/repositoryAvatar'
import { GitDialog } from '../molecules/GitDialog'
import { RepositoryAvatarPicker } from '../molecules/RepositoryAvatarPicker'
import { Button } from '../atoms/Button'

export function RepositoryDialog({
  workspace,
  request,
  onDismiss
}: {
  workspace: GitWorkspace
  request: GitRequest
  onDismiss: () => void
}) {
  const [mode, setMode] = useState<'open' | 'create'>('open')
  const [path, setPath] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextRepositoryColor(workspace.saved))
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const busy = picking || !!workspace.busy
  const displayName =
    mode === 'create'
      ? name
      : (path
          .replace(/[\\/]+$/, '')
          .split(/[\\/]/)
          .pop() ?? '')

  return (
    <GitDialog title={mode === 'open' ? 'Open repository' : 'Create repository'} busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const success =
            mode === 'open' ? await workspace.open(path, color) : await workspace.create(path, name.trim(), color)
          if (success) onDismiss()
        }}
      >
        <div className="view-switch" role="group" aria-label="Repository action">
          <Button type="button" disabled={busy} aria-pressed={mode === 'open'} onClick={() => setMode('open')}>
            Open existing
          </Button>
          <Button type="button" disabled={busy} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
            Create new
          </Button>
        </div>
        <label>
          {mode === 'open' ? 'Repository folder' : 'Parent folder'}
          <div className="git-input-action">
            <input
              required
              disabled={busy}
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="Choose a local folder"
            />
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setPicking(true)
                setError('')
                try {
                  const selected = await request<string | null>('git_pick_path', { file: false })
                  if (selected) setPath(selected)
                } catch (error) {
                  setError(String(error))
                } finally {
                  setPicking(false)
                }
              }}
            >
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>
        </label>
        {mode === 'create' && (
          <label>
            Repository name
            <input
              required
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-project"
            />
          </label>
        )}
        <RepositoryAvatarPicker name={displayName} value={color} onChange={setColor} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="discard-actions">
          <Button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            className="primary"
            type="submit"
            disabled={busy || !path.trim() || (mode === 'create' && !name.trim())}
          >
            {workspace.busy || (mode === 'open' ? 'Open repository' : 'Create repository')}
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
