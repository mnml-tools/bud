import { DiffLines } from '../molecules/DiffLines'

export function ChangeDiffPane({
  path,
  staged,
  diff,
  loading,
  error
}: {
  path?: string
  staged: boolean
  diff: string
  loading: boolean
  error: string
}) {
  const lines = diff.split('\n')
  const firstHunk = lines.findIndex((line) => line.startsWith('@@'))
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
            <DiffLines diff={visibleLines.join('\n')} path={path} />
          ) : (
            <p className="git-diff-message">No text diff available for this file.</p>
          )}
        </>
      )}
    </section>
  )
}
