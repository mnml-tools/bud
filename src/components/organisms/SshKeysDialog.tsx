import { useState } from 'react'
import { FolderOpen, KeyRound, Trash2 } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import type { GitRequest } from '../../services/git'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'
import { SshKeyPasswordDialog } from './SshKeyPasswordDialog'

export function SshKeysDialog({
  workspace,
  request,
  onDismiss
}: {
  workspace: GitWorkspace
  request: GitRequest
  onDismiss: () => void
}) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [password, setPassword] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <GitDialog title="SSH identities" eyebrow="WORK AND PERSONAL" busy={busy} onDismiss={onDismiss}>
      <p className="git-hint">
        Register existing private keys and choose an identity for each repository. Bud keeps key passwords in your
        system credential store. Private key files stay on your machine.
      </p>
      <div className="git-key-list">
        {workspace.keys.length === 0 && (
          <p className="git-hint">No keys registered. Your SSH config and agent work by default.</p>
        )}
        {workspace.keys.map((key) => (
          <div className="git-key-row" key={key.id}>
            <KeyRound size={15} />
            <div>
              <strong>{key.name}</strong>
              <code title={key.path}>{key.path}</code>
            </div>
            <Button disabled={busy} onClick={() => setEditingKey(key.id)}>
              {key.hasPassword ? 'Change password' : 'Set password'}
            </Button>
            <Button
              aria-label={`Remove ${key.name} from Bud`}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await workspace.removeKey(key.id)
                } catch (error) {
                  setError(String(error))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          setBusy(true)
          try {
            await workspace.addKey(name.trim(), path, password)
            setName('')
            setPath('')
            setPassword('')
          } catch (error) {
            setError(String(error))
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Identity name
          <input
            autoFocus
            required
            placeholder="Personal GitHub or Work GitLab"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Private key file
          <div className="git-input-action">
            <input
              required
              value={path}
              placeholder="Select a private key, without .pub"
              onChange={(event) => setPath(event.target.value)}
            />
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  const file = await request<string | null>('git_pick_path', { file: true })
                  if (file) setPath(file)
                } catch (error) {
                  setError(String(error))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>
        </label>
        <label>
          Key password (optional)
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={busy || !name.trim() || !path.trim()} type="submit">
          Add identity
        </Button>
      </form>
      <label className="git-default-key">
        Default for new repositories
        <select value={workspace.defaultKey} onChange={(event) => workspace.changeDefaultKey(event.target.value)}>
          <option value="">SSH config / agent</option>
          {workspace.keys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.name}
            </option>
          ))}
        </select>
      </label>
      <p className="git-hint">
        Saved passwords unlock encrypted keys automatically. Without a saved password, encrypted keys can use your SSH
        agent. Unknown hosts must first be verified through SSH in a terminal.
      </p>
      <div className="discard-actions">
        <Button onClick={onDismiss} disabled={busy}>
          Done
        </Button>
      </div>
      {editingKey && workspace.keys.find((key) => key.id === editingKey) && (
        <SshKeyPasswordDialog
          identity={workspace.keys.find((key) => key.id === editingKey)!}
          workspace={workspace}
          request={request}
          onDismiss={() => setEditingKey(null)}
        />
      )}
    </GitDialog>
  )
}
