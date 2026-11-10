import { useMemo } from 'react'
import { highlightDiff } from '../../lib/diffHighlight'
import { Button } from '../atoms/Button'

export function DiffLines({
  diff,
  path,
  hunkAction
}: {
  diff: string
  path?: string
  hunkAction?: { label: string; disabled: boolean; onAction: (hunk: number) => void }
}) {
  const lines = useMemo(() => highlightDiff(diff, path).filter((line) => line.className !== 'metadata'), [diff, path])

  let hunk = -1

  return (
    <pre className="git-diff-lines">
      {lines.map((line, index) => {
        if (line.className === 'hunk') hunk++
        const hunkIndex = hunk

        return (
          <div key={index} className={line.className}>
            {line.html !== undefined ? (
              <>
                <span className="git-diff-prefix">{line.prefix}</span>
                <span className="git-diff-code" dangerouslySetInnerHTML={{ __html: line.html }} />
              </>
            ) : (
              line.text || ' '
            )}
            {line.className === 'hunk' && hunkAction && (
              <Button
                className="git-hunk-action"
                disabled={hunkAction.disabled}
                onClick={() => hunkAction.onAction(hunkIndex)}
                aria-label={`${hunkAction.label} ${hunkIndex + 1}`}
              >
                {hunkAction.label}
              </Button>
            )}
          </div>
        )
      })}
    </pre>
  )
}
