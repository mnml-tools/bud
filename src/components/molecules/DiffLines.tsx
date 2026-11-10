import { useMemo } from 'react'
import { highlightDiff } from '../../lib/diffHighlight'

export function DiffLines({ diff, path }: { diff: string; path?: string }) {
  const lines = useMemo(() => highlightDiff(diff, path).filter((line) => line.className !== 'metadata'), [diff, path])

  return (
    <pre className="git-diff-lines">
      {lines.map((line, index) => (
        <div key={index} className={line.className}>
          {line.html !== undefined ? (
            <>
              <span className="git-diff-prefix">{line.prefix}</span>
              <span className="git-diff-code" dangerouslySetInnerHTML={{ __html: line.html }} />
            </>
          ) : (
            line.text || ' '
          )}
        </div>
      ))}
    </pre>
  )
}
