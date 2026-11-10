import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import type { GitRequest } from '../../services/git'
import { version } from '../../../package.json'
import { Button } from '../atoms/Button'

export function UpdateSettings({ request, onUpdate }: { request: GitRequest; onUpdate: (update: Update) => void }) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return (
    <section className="settings-section">
      <div>
        <h2>Updates &amp; about</h2>
        <p>Keep Bud up to date and find project information.</p>
      </div>
      <div className="settings-about-version">
        <strong>Bud</strong>
        <span>Version {version}</span>
        <span>A local workspace for Git repositories.</span>
      </div>
      <div className="settings-option">
        <h3>App updates</h3>
        <p>Bud checks for updates on startup. Downloads and installation require your action.</p>
        <Button
          disabled={checking || !isTauri()}
          onClick={async () => {
            setChecking(true)
            setError('')
            setMessage('')
            try {
              const update = await check({ timeout: 15000 })
              if (update) onUpdate(update)
              else setMessage('You’re up to date.')
            } catch (error) {
              setError(String(error))
            } finally {
              setChecking(false)
            }
          }}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
        {!isTauri() && <p>Update checks are available in the desktop app.</p>}
        {message && <p role="status">{message}</p>}
      </div>
      <Button
        onClick={async () => {
          setError('')
          try {
            if (isTauri()) await request('open_latest_release')
            else window.open('https://github.com/mnml-tools/bud/releases/latest', '_blank', 'noopener,noreferrer')
          } catch (error) {
            setError(String(error))
          }
        }}
      >
        Release notes
      </Button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
