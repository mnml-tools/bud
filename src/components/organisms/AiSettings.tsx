import { useEffect, useState } from 'react'
import type { GitRequest } from '../../services/git'
import { Button } from '../atoms/Button'

export type CommitAiSettings = { enabled: boolean; endpoint: string; model: string }

export function AiSettings({ request, onBusyChange }: { request: GitRequest; onBusyChange: (busy: boolean) => void }) {
  const [settings, setSettings] = useState<CommitAiSettings>({ enabled: false, endpoint: '', model: '' })
  const [apiKey, setApiKey] = useState('')
  const [replaceKey, setReplaceKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    onBusyChange(saving)
  }, [saving, onBusyChange])

  useEffect(() => {
    let cancelled = false
    setError('')

    request<CommitAiSettings>('ai_settings').then(
      (value) => {
        if (!cancelled) {
          setSettings(value)
          setLoading(false)
        }
      },
      (error) => {
        if (!cancelled) setError(String(error))
      }
    )

    return () => {
      cancelled = true
    }
  }, [request, loadAttempt])

  return (
    <section className="settings-section settings-ai">
      <div>
        <h2>AI commit messages</h2>
        <p>Configure a provider and API key for drafting commit messages.</p>
      </div>
      <form
        className="git-ai-settings"
        onSubmit={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          setSaving(true)
          setError('')
          setSaved(false)

          try {
            await request('ai_save_settings', { settings, apiKey: replaceKey ? apiKey : null })
            setSaved(true)
            setApiKey('')
            setReplaceKey(false)
          } catch (error) {
            setError(String(error))
          } finally {
            setSaving(false)
          }
        }}
      >
        <p>Optional. Generating sends staged changes to your chosen provider. Review the draft before committing.</p>
        <label className="git-ai-enable">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={loading || saving}
            onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
          />
          Enable AI commit messages
        </label>
        <label>
          API base URL
          <input
            type="url"
            placeholder="https://your-provider.example/v1"
            required={settings.enabled}
            disabled={loading || saving}
            value={settings.endpoint}
            onChange={(event) => {
              setSettings({ ...settings, endpoint: event.target.value })
              setApiKey('')
              setReplaceKey(false)
            }}
          />
        </label>
        <p className="git-hint">
          Use a provider with an OpenAI-compatible API, or a local server such as Ollama (http://localhost:11434/v1).
        </p>
        <label>
          Model ID
          <input
            placeholder="Model ID from your provider"
            required={settings.enabled}
            disabled={loading || saving}
            value={settings.model}
            onChange={(event) => setSettings({ ...settings, model: event.target.value })}
          />
        </label>
        <label>
          API key
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep the saved key"
            disabled={loading || saving}
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value)
              setReplaceKey(true)
            }}
          />
        </label>
        <p className="git-hint">
          Keys are stored in your system credential store. Local servers may not require a key.
        </p>
        <Button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            setApiKey('')
            setReplaceKey(true)
          }}
        >
          Remove saved key
        </Button>
        {saved && <p role="status">AI settings saved.</p>}
        {error && <p role="alert">{error}</p>}
        {error && loading && (
          <Button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Retry loading settings
          </Button>
        )}
        <div className="discard-actions">
          <Button type="submit" className="primary" disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </section>
  )
}
