import { useEffect, useState } from 'react'
import type { GitRequest } from '../../services/git'
import { Button } from '../atoms/Button'

type CliStatus = { supported: boolean; installed: boolean; path: string; profile: string }

export function CliSettings({ request, onBusyChange }: { request: GitRequest; onBusyChange: (busy: boolean) => void }) {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void request<CliStatus>('cli_status')
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((error) => {
        if (!cancelled) setError(String(error))
      })
    return () => {
      cancelled = true
    }
  }, [request])

  return (
    <section className="settings-section">
      <div>
        <h2>Terminal command</h2>
        <p>Open repositories in Bud directly from your terminal.</p>
      </div>
      <div className="settings-option">
        <h3>bud</h3>
        <p>
          Run <code>bud</code> inside a repository, or <code>bud /path/to/repository</code>. Uses your existing Bud
          window.
        </p>
        {status?.supported && (
          <p>
            Installs <code>{status.path}</code> and adds its folder to PATH in <code>{status.profile}</code>.
          </p>
        )}
        {status && !status.supported && <p>Available on macOS and Linux.</p>}
        <Button
          disabled={busy || !status?.supported}
          onClick={async () => {
            setBusy(true)
            onBusyChange(true)
            setError('')
            setMessage('')
            try {
              setStatus(await request<CliStatus>('cli_install'))
              setMessage('Installed. Open a new terminal tab, then run bud inside a repository.')
            } catch (error) {
              setError(String(error))
            } finally {
              setBusy(false)
              onBusyChange(false)
            }
          }}
        >
          {busy ? 'Installing…' : status?.installed ? 'Reinstall command' : 'Install command'}
        </Button>
        {status?.installed && !message && <p>Terminal command installed.</p>}
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
