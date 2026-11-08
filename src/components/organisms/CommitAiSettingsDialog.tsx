import { useEffect, useState } from 'react'
import type { GitRequest } from '../../services/git'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

export type CommitAiSettings = { enabled: boolean; endpoint: string; model: string }

export function CommitAiSettingsDialog({ request, onDismiss }: { request: GitRequest; onDismiss: () => void }) {
  const [settings, setSettings] = useState<CommitAiSettings>({ enabled: false, endpoint: '', model: '' })
  const [apiKey, setApiKey] = useState('')
  const [replaceKey, setReplaceKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

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
  }, [request])

  return (
    <GitDialog title="AI commit messages" busy={saving} onDismiss={onDismiss}>
      <form
        className="git-ai-settings"
        onSubmit={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          setSaving(true)
          setError('')

          try {
            await request('ai_save_settings', { settings, apiKey: replaceKey ? apiKey : null })
            onDismiss()
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
        {error && <p role="alert">{error}</p>}
        <div className="discard-actions">
          <Button type="button" disabled={saving} onClick={onDismiss}>
            Cancel
          </Button>
          <Button type="submit" className="primary" disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </GitDialog>
  )
}
