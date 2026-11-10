import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Commit } from '../../types/git'
import { DiffLines } from '../molecules/DiffLines'
import { Button } from '../atoms/Button'

export function CommitDiffPanel({
  commit,
  loadDiff,
  onClose
}: {
  commit: Commit
  loadDiff: (hash: string) => Promise<string>
  onClose: () => void
}) {
  const [preview, setPreview] = useState({ diff: '', error: '', loading: true })
  const load = useRef(loadDiff)
  load.current = loadDiff

  useEffect(() => {
    let cancelled = false
    setPreview({ diff: '', error: '', loading: true })
    load.current(commit.hash).then(
      (diff) => {
        if (!cancelled) setPreview({ diff, error: '', loading: false })
      },
      (error) => {
        if (!cancelled) setPreview({ diff: '', error: String(error), loading: false })
      }
    )

    return () => {
      cancelled = true
    }
  }, [commit.hash])

  return (
    <section className="git-commit-diff-panel" aria-label="Commit diffs" aria-busy={preview.loading}>
      <div className="git-commit-details">
        <div className="git-commit-diff-title">
          <strong>{commit.subject}</strong>
          <Button onClick={onClose} title="Close commit diffs" aria-label="Close commit diffs">
            <X size={14} />
          </Button>
        </div>
        <code>{commit.hash}</code>
        <span>
          {commit.author} · {new Date(commit.date).toLocaleString()}
        </span>
        {commit.parents.length > 1 && <span>Merge changes compared with the first parent.</span>}
      </div>
      <div className="git-commit-diff-scroll" tabIndex={0} aria-label="Scrollable commit diff">
        {preview.loading ? (
          <p className="git-diff-message" role="status">
            Loading diffs…
          </p>
        ) : preview.error ? (
          <p className="git-diff-message" role="alert">
            {preview.error}
          </p>
        ) : !preview.diff.trim() ? (
          <p className="git-diff-message">No file changes in this commit.</p>
        ) : (
          <DiffLines diff={preview.diff} />
        )}
      </div>
    </section>
  )
}
