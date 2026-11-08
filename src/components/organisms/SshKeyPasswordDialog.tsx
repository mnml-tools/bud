import { useEffect, useState } from 'react'
import type { SshKey } from '../../types/git'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import type { GitRequest } from '../../services/git'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

export function SshKeyPasswordDialog({
  identity,
  workspace,
  request,
  onDismiss
}: {
  identity: SshKey
  workspace: GitWorkspace
  request: GitRequest
  onDismiss: () => void
}) {
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(!!identity.hasPassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    void request<boolean>('git_key_password_status', { path: identity.path })
      .then((value) => {
        if (!disposed) setSaved(value)
      })
      .catch((error) => {
        if (!disposed) setError(String(error))
      })

    return () => {
      disposed = true
    }
  }, [identity.path, request])

  const save = async (value: string) => {
    setBusy(true)
    setError('')

    try {
      await workspace.saveKeyPassword(identity.id, value)
      setPassword('')
      onDismiss()
    } catch (error) {
      setError(String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GitDialog title={`Key password · ${identity.name}`} busy={busy} onDismiss={onDismiss}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save(password)
        }}
      >
        <p className="git-hint">
          {saved ? 'A password is saved. Enter a new one to replace it.' : 'No password is saved for this identity.'}{' '}
          Passwords are kept in your system credential store and used automatically for SSH actions.
        </p>
        <label>
          Key password
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" disabled={busy || !saved} onClick={() => void save('')}>
            Remove saved password
          </Button>
          <div>
            <Button type="button" disabled={busy} onClick={onDismiss}>
              Cancel
            </Button>
            <Button className="primary" type="submit" disabled={busy || !password}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </div>
      </form>
    </GitDialog>
  )
}
