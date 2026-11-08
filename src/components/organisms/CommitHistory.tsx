import { AuthorAvatar } from '../atoms/AuthorAvatar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GitCommitHorizontal, Search } from 'lucide-react'
import { buildCommitGraph, graphColors } from '../../lib/commitGraph'
import type { History } from '../../types/git'
import { Button } from '../atoms/Button'

const rowHeight = 38
const commitDateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export function CommitHistory({
  history,
  selected,
  busy,
  onMore,
  filterRef,
  githubRepo
}: {
  history: History
  githubRepo?: string
  selected: string
  busy: boolean
  onMore: () => void
  filterRef: React.RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  const [scroll, setScroll] = useState(0)
  const [height, setHeight] = useState(600)
  const [focused, setFocused] = useState('')
  const viewport = useRef<HTMLDivElement>(null)
  const graph = useMemo(() => buildCommitGraph(history.commits), [history.commits])
  const graphWidth = Math.max(90, graph.reduce((width, row) => Math.max(width, row.width), 0) * 18 + 28)
  const matching = useMemo(
    () =>
      new Set(
        history.commits
          .filter((commit) =>
            `${commit.subject} ${commit.author} ${commit.hash} ${commit.refs}`
              .toLowerCase()
              .includes(query.toLowerCase())
          )
          .map((commit) => commit.hash)
      ),
    [history.commits, query]
  )
  const selectedCommit = history.commits.find((commit) => commit.hash === (focused || selected))
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 10)
  const end = Math.min(history.commits.length, start + Math.ceil(height / rowHeight) + 20)

  useEffect(() => {
    const element = viewport.current!
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setFocused('')
    const index = history.commits.findIndex((commit) => commit.hash === selected)
    if (index >= 0) viewport.current?.scrollTo({ top: Math.max(0, index * rowHeight - 100) })
  }, [selected, history.commits])

  return (
    <section className="git-history">
      <div className="git-history-heading">
        <div>
          <GitCommitHorizontal size={15} />
          <strong>Commit history</strong>
          <span>
            {history.commits.length}
            {history.hasMore ? '+' : ''}
          </span>
        </div>
        <label className="git-history-search">
          <Search size={13} />
          <input
            ref={filterRef}
            aria-label="Find commits"
            placeholder="Find a commit, author, or SHA…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {query && (
        <p className="git-search-info" role="status">
          {matching.size} matches in loaded history. Other commits stay visible to preserve graph connections.
        </p>
      )}
      {selected && !history.commits.some((commit) => commit.hash === selected) && (
        <p className="git-search-info">This branch tip is in older history. Load more commits to reach it.</p>
      )}
      <div
        className="git-history-columns"
        style={{ gridTemplateColumns: `${graphWidth}px minmax(240px, 1fr) 150px 160px` }}
      >
        <span>GRAPH</span>
        <span>COMMIT</span>
        <span>AUTHOR</span>
        <span>DATE</span>
      </div>
      <div className="git-history-scroll" ref={viewport} onScroll={(event) => setScroll(event.currentTarget.scrollTop)}>
        {history.commits.length === 0 ? (
          <div className="git-history-empty">
            <GitCommitHorizontal size={28} />
            <h2>A fresh start.</h2>
            <p>This repository has no commits yet. Your history will appear here after the first commit.</p>
          </div>
        ) : (
          <div style={{ height: history.commits.length * rowHeight, minWidth: graphWidth + 520, position: 'relative' }}>
            {history.commits.slice(start, end).map((commit, offset) => {
              const index = start + offset
              const row = graph[index]
              const x = (lane: number) => 20 + lane * 18
              const active = commit.hash === (focused || selected)

              return (
                <button
                  key={commit.hash}
                  className={`git-commit-row${active ? ' selected' : ''}${query && !matching.has(commit.hash) ? ' dimmed' : ''}`}
                  style={{
                    top: index * rowHeight,
                    height: rowHeight,
                    gridTemplateColumns: `${graphWidth}px minmax(240px, 1fr) 150px 160px`
                  }}
                  onClick={() => setFocused(commit.hash)}
                  aria-pressed={active}
                  title={`${commit.hash}\n${commit.subject}`}
                >
                  <svg width={graphWidth} height={rowHeight} aria-hidden="true">
                    {row.lines
                      .filter((line) => line.from !== row.lane)
                      .map((line, i) => (
                        <path
                          key={`pass${i}`}
                          d={`M ${x(line.from)} 0 L ${x(line.from)} 19 C ${x(line.from)} 29 ${x(line.to)} 29 ${x(line.to)} 38`}
                          fill="none"
                          stroke={graphColors[line.color]}
                          strokeWidth="2"
                        />
                      ))}
                    {index > 0 && graph[index - 1].lines.some((line) => line.to === row.lane) && (
                      <path d={`M ${x(row.lane)} 0 V 19`} stroke={graphColors[row.color]} strokeWidth="2" />
                    )}
                    {row.lines
                      .filter((line) => line.from === row.lane)
                      .map((line, i) => (
                        <path
                          key={`parent${i}`}
                          d={`M ${x(row.lane)} 19 C ${x(row.lane)} 29 ${x(line.to)} 29 ${x(line.to)} 38`}
                          fill="none"
                          stroke={graphColors[line.color]}
                          strokeWidth="2"
                        />
                      ))}
                    <circle
                      cx={x(row.lane)}
                      cy="19"
                      r="4"
                      stroke={graphColors[row.color]}
                      fill="var(--background)"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="git-commit-message">
                    {commit.refs && (
                      <span className="git-ref" title={commit.refs}>
                        {commit.refs}
                      </span>
                    )}
                    <span>{commit.subject}</span>
                    <code>{commit.hash.slice(0, 7)}</code>
                  </span>
                  <span className="git-commit-author" title={commit.author}>
                    <AuthorAvatar
                      key={commit.authorEmail || commit.author}
                      name={commit.author}
                      email={commit.authorEmail}
                      githubRepo={githubRepo}
                      commit={commit.hash}
                    />
                    <span>{commit.author}</span>
                  </span>
                  <time
                    dateTime={commit.date}
                    title={new Date(commit.date).toLocaleString(undefined, { timeZoneName: 'short' })}
                  >
                    {commitDateFormat.format(new Date(commit.date))}
                  </time>
                </button>
              )
            })}
          </div>
        )}
        {history.hasMore && (
          <div className="git-load-more">
            <Button disabled={busy} onClick={onMore}>
              {busy ? 'Loading…' : 'Load 300 more commits'}
            </Button>
          </div>
        )}
      </div>
      {selectedCommit && (
        <div className="git-commit-details">
          <strong>{selectedCommit.subject}</strong>
          <code>{selectedCommit.hash}</code>
          <span>
            {selectedCommit.author} · {new Date(selectedCommit.date).toLocaleString()}
          </span>
          <span>Parents: {selectedCommit.parents.map((hash) => hash.slice(0, 7)).join(', ') || 'Root commit'}</span>
        </div>
      )}
    </section>
  )
}
