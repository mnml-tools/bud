import { useEffect, useState } from 'react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { Sparkles, Settings2 } from 'lucide-react'
import type { CommitAiSettings } from './AiSettings'
import { Button } from '../atoms/Button'

export function CommitForm({ workspace, onOpenAiSettings }: { workspace: GitWorkspace; onOpenAiSettings: () => void }) {
  const storageKey = `bud.commitDraft:${workspace.repository!.path}`
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
      if (typeof saved?.message === 'string' && typeof saved?.description === 'string')
        return saved as { message: string; description: string }
    } catch {}

    return { message: '', description: '' }
  })
  const stagedCount = (workspace.repository!.changes ?? []).filter(
    (file) => file.status !== '??' && file.status[0] !== ' '
  ).length
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [suggestion, setSuggestion] = useState<{ message: string; description: string } | null>(null)
  const busy = !!workspace.busy || generating

  const generate = async () => {
    if (busy || !stagedCount) return

    setGenerating(true)
    setGenerationError('')
    setSuggestion(null)

    try {
      const settings = await workspace.request<CommitAiSettings>('ai_settings')
      if (!settings.enabled) {
        onOpenAiSettings()
        return
      }

      const result = await workspace.request<{ message: string; description: string }>('ai_generate_commit', {
        path: workspace.repository!.path
      })
      if (draft.message.trim() || draft.description.trim()) setSuggestion(result)
      else setDraft(result)
    } catch (error) {
      setGenerationError(String(error))
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {}
  }, [storageKey, draft])

  return (
    <form
      className="git-commit-form"
      aria-label="Commit staged changes"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy || !stagedCount || !draft.message.trim()) return

        if (await workspace.commit(draft.message, draft.description)) setDraft({ message: '', description: '' })
      }}
    >
      <label>
        Commit message
        <div className="git-commit-message-input">
          <input
            aria-label="Commit message"
            placeholder="Summarize your changes"
            value={draft.message}
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, message: event.target.value })}
          />
          <Button
            type="button"
            className="git-ai-generate"
            aria-label="Generate commit message with AI"
            title="Generate commit message and description with AI"
            disabled={busy || !stagedCount}
            onClick={() => void generate()}
          >
            <Sparkles size={14} className={generating ? 'git-spinning' : ''} />
          </Button>
        </div>
      </label>
      <label>
        Description <span>(optional)</span>
        <textarea
          aria-label="Commit description"
          placeholder="Add more detail…"
          rows={3}
          value={draft.description}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </label>
      {generationError && <p role="alert">{generationError}</p>}
      {suggestion && (
        <div className="git-ai-suggestion">
          <strong>{suggestion.message}</strong>
          <p>{suggestion.description}</p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(suggestion)
              setSuggestion(null)
            }}
          >
            Use generated draft
          </Button>
          <Button type="button" onClick={() => setSuggestion(null)}>
            Dismiss
          </Button>
        </div>
      )}
      <div className="git-commit-actions">
        <span>
          {stagedCount ? `${stagedCount} staged ${stagedCount === 1 ? 'file' : 'files'}` : 'Stage changes to commit'}
        </span>
        <Button
          type="button"
          title="AI commit settings"
          aria-label="AI commit settings"
          disabled={busy}
          onClick={() => onOpenAiSettings()}
        >
          <Settings2 size={13} />
        </Button>
        <Button type="submit" className="primary" disabled={busy || !stagedCount || !draft.message.trim()}>
          {workspace.busy === 'Committing' ? 'Committing…' : 'Commit'}
        </Button>
      </div>
    </form>
  )
}
