import { DiffLines } from '../molecules/DiffLines'

export function ChangeDiffPane({
  path,
  staged,
  diff,
  loading,
  error,
  busy,
  onHunkAction
}: {
  path?: string
  staged: boolean
  diff: string
  loading: boolean
  error: string
  busy: boolean
  onHunkAction: (hunk: number) => void
}) {
  const lines = diff.split('\n')
  const firstHunk = lines.findIndex((line) => line.startsWith('@@'))
  const canStageHunks =
    firstHunk >= 0 &&
    diff.startsWith('diff --git ') &&
    !lines
      .slice(0, firstHunk)
      .some((line) => /^(?:new file mode |deleted file mode |old mode |new mode |rename |copy )/.test(line))
  const visibleLines =
    firstHunk >= 0
      ? lines.slice(firstHunk)
      : lines.filter(
          (line) =>
            !/^(diff --git |index |--- |\+\+\+ |(?:new|deleted) file mode |(?:old|new) mode |(?:dis)?similarity index |(?:rename|copy) (?:from|to) )/.test(
              line
            )
        )

  return (
    <section className="git-change-diff" aria-label="File diff" aria-busy={loading}>
      {path && (
        <>
          <div className="git-change-diff-heading">
            <strong>{path}</strong>
            <span>{staged ? 'Staged' : 'Unstaged'}</span>
          </div>
          {loading ? (
            <p className="git-diff-message" role="status">
              Loading diff…
            </p>
          ) : error ? (
            <p className="git-diff-message" role="alert">
              {error}
            </p>
          ) : visibleLines.some((line) => line.trim()) ? (
            <>
              <p className="git-hunk-hint">
                {canStageHunks
                  ? staged
                    ? 'Unstage individual changes below to leave them out of the commit.'
                    : 'Stage individual changes below, then commit the staged changes.'
                  : 'Use the file action to stage or unstage this file.'}
              </p>
              <DiffLines
                diff={visibleLines.join('\n')}
                path={path}
                hunkAction={
                  canStageHunks
                    ? { label: staged ? 'Unstage hunk' : 'Stage hunk', disabled: busy, onAction: onHunkAction }
                    : undefined
                }
              />
            </>
          ) : (
            <p className="git-diff-message">No text diff available for this file.</p>
          )}
        </>
      )}
    </section>
  )
}
