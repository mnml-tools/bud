import { useEffect, useRef, useState } from 'react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'

export function ImageDiffPane({ workspace, path, staged }: { workspace: GitWorkspace; path: string; staged: boolean }) {
  const [preview, setPreview] = useState<{ before: string | null; after: string | null } | null>(null)
  const [error, setError] = useState('')
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const load = useRef(workspace.imageDiff)
  load.current = workspace.imageDiff

  useEffect(() => {
    let cancelled = false
    setError('')
    load.current(path, staged).then(
      (result) => {
        if (!cancelled)
          setPreview((previous) =>
            previous?.before === result.before && previous?.after === result.after ? previous : result
          )
      },
      (error) => {
        if (!cancelled) setError(String(error))
      }
    )
    return () => {
      cancelled = true
    }
  }, [workspace.repository, path, staged])

  return (
    <section className="git-change-diff" aria-label="Image diff" aria-busy={!preview && !error}>
      <div className="git-change-diff-heading">
        <strong>{path}</strong>
        <span>{staged ? 'Staged' : 'Unstaged'}</span>
      </div>
      {error ? (
        <p className="git-diff-message" role="alert">
          {error}
        </p>
      ) : !preview ? (
        <p className="git-diff-message" role="status">
          Loading image…
        </p>
      ) : (
        <div className="git-image-comparison">
          {(['before', 'after'] as const).map((side) => (
            <figure key={side}>
              <figcaption>{side === 'before' ? 'Before' : 'After'}</figcaption>
              <div className="git-image-preview">
                {!preview[side] ? (
                  <span>{side === 'before' ? 'New image' : 'Image removed'}</span>
                ) : failed[side] ? (
                  <span>Unable to display this image format.</span>
                ) : (
                  <img
                    src={preview[side]!}
                    alt={`${side === 'before' ? 'Before' : 'After'}: ${path}`}
                    onError={() => setFailed((current) => ({ ...current, [side]: true }))}
                  />
                )}
              </div>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}
