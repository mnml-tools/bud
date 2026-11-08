import { useState } from 'react'
import { FolderOpen, GitFork } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import type { GitRequest } from '../../services/git'
import { nextRepositoryColor } from '../../lib/repositoryAvatar'
import { RepositoryAvatarPicker } from '../molecules/RepositoryAvatarPicker'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

type Props = { workspace: GitWorkspace; request: GitRequest; onDismiss: () => void }

export function CloneRepositoryDialog({ workspace, request, onDismiss }: Props) {
  const [url, setUrl] = useState('')
  const [avatarColor, setAvatarColor] = useState(() => nextRepositoryColor(workspace.saved))
  const [parent, setParent] = useState('')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [keyId, setKeyId] = useState(workspace.defaultKey)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)
  const busy = !!workspace.busy || picking

  const pick = async () => {
    setPicking(true)
    try {
      const path = await request<string | null>('git_pick_path', { file: false })
      if (path) setParent(path)
    } catch (error) {
      setError(String(error))
    } finally {
      setPicking(false)
    }
  }

  return (
    <GitDialog title="Clone a repository" eyebrow="BRING YOUR CODE HOME" busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (await workspace.clone(url.trim(), parent, name.trim(), keyId, avatarColor)) onDismiss()
        }}
      >
        <label>
          Repository URL
          <input
            autoFocus
            required
            value={url}
            placeholder="git@github.com:you/project.git"
            disabled={busy}
            onChange={(event) => {
              setUrl(event.target.value)
              if (!nameEdited)
                setName(
                  event.target.value
                    .trim()
                    .replace(/\/+$/, '')
                    .split(/[/:]/)
                    .pop()
                    ?.replace(/\.git$/, '') ?? ''
                )
            }}
          />
        </label>
        <label>
          Destination folder
          <div className="git-input-action">
            <input
              required
              value={parent}
              placeholder="Choose the parent folder"
              disabled={busy}
              onChange={(event) => setParent(event.target.value)}
            />
            <Button type="button" disabled={busy} onClick={() => void pick()}>
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>
        </label>
        <label>
          New folder name
          <input
            required
            value={name}
            disabled={busy}
            onChange={(event) => {
              setNameEdited(true)
              setName(event.target.value)
            }}
          />
        </label>
        <label>
          SSH identity
          <select value={keyId} disabled={busy} onChange={(event) => setKeyId(event.target.value)}>
            <option value="">SSH config / agent</option>
            {workspace.keys.map((key) => (
              <option value={key.id} key={key.id}>
                {key.name}
              </option>
            ))}
          </select>
        </label>
        <RepositoryAvatarPicker name={name} value={avatarColor} onChange={setAvatarColor} />
        <p className="git-hint">
          SSH keys apply to SSH URLs. HTTPS uses your existing Git credential helper. Encrypted keys use their saved
          password or your SSH agent.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="discard-actions">
          <Button type="button" disabled={busy} onClick={onDismiss}>
            Cancel
          </Button>
          <Button className="primary" disabled={busy || !url.trim() || !parent || !name.trim()} type="submit">
            <GitFork size={14} />
            {workspace.busy || 'Clone repository'}
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
