import { GitDialog } from '../molecules/GitDialog'
import { CommitDiffPanel } from './CommitDiffPanel'
import { AuthorAvatar } from '../atoms/AuthorAvatar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GitCommitHorizontal, Search, Tag, Cloud, Check } from 'lucide-react'
import { buildCommitGraph, graphColors as lanePalette } from '../../lib/commitGraph'
import type { History } from '../../types/git'
import { Button } from '../atoms/Button'
import { useTheme } from '../../hooks/useTheme'

const rowHeight = 28
const nodeY = rowHeight / 2
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
  loadDiff,
  selected,
  busy,
  onMore,
  onCheckout,
  filterRef,
  githubRepo
}: {
  history: History
  loadDiff: (hash: string) => Promise<string>
  githubRepo?: string
  selected: string
  busy: boolean
  onCheckout: (hash: string) => void
  onMore: () => void
  filterRef: React.RefObject<HTMLInputElement | null>
}) {
  const { accent } = useTheme()
  const paletteStart = { green: 0, blue: 2, purple: 3, pink: 5, orange: 6 }[accent]
  const graphColors = lanePalette.map((_, index) =>
    index === 0 ? 'var(--accent)' : lanePalette[(paletteStart + index) % lanePalette.length]
  )

  const [checkoutTarget, setCheckoutTarget] = useState<History['commits'][number] | null>(null)
  const [query, setQuery] = useState('')
  const [scroll, setScroll] = useState(0)
  const [height, setHeight] = useState(600)
  const [focused, setFocused] = useState('')
  const [diffClosed, setDiffClosed] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const graph = useMemo(() => buildCommitGraph(history.commits), [history.commits])
  const graphWidth = Math.max(54, graph.reduce((width, row) => Math.max(width, row.width), 0) * 18 + 18)
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
  const headIndex = history.commits.findIndex((commit) =>
    commit.refs.split(', ').some((ref) => ref === 'HEAD' || ref.startsWith('HEAD -> '))
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
    setDiffClosed(false)
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
      <div className="git-history-columns" style={{ gridTemplateColumns: `36px minmax(240px, 1fr) 150px 160px` }}>
        <span aria-hidden="true" />
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
              const rowGraphWidth = x(Math.max(row.lane, ...row.lines.flatMap((line) => [line.from, line.to]))) + 16
              const activeBranch = commit.refs
                .split(', ')
                .find((ref) => ref.startsWith('HEAD -> '))
                ?.slice(8)
              const refs = commit.refs
                .split(', ')
                .map((ref) => (ref === 'HEAD' ? '' : ref.replace(/^HEAD -> /, '')))
                .filter((ref) => Boolean(ref) && ref !== 'origin/HEAD')
              const syncedBranches = new Set(
                refs.filter((ref) => !ref.startsWith('tag: ') && refs.includes(`origin/${ref}`))
              )
              const active = commit.hash === (focused || selected)

              return (
                <button
                  key={commit.hash}
                  className={`git-commit-row${active ? ' selected' : ''}${headIndex >= 0 && index < headIndex ? ' above-head' : ''}${query && !matching.has(commit.hash) ? ' dimmed' : ''}`}
                  style={{
                    top: index * rowHeight,
                    height: rowHeight,
                    gridTemplateColumns: `${rowGraphWidth}px minmax(240px, 1fr) 150px 160px`
                  }}
                  onClick={() => {
                    setFocused(commit.hash)
                    setDiffClosed(false)
                  }}
                  onDoubleClick={() => {
                    if (!busy && index !== headIndex) setCheckoutTarget(commit)
                  }}
                  aria-pressed={active}
                  title={`${commit.hash}\n${commit.subject}`}
                >
                  <svg width={rowGraphWidth} height={rowHeight} aria-hidden="true">
                    {row.lines
                      .filter((line) => line.from !== row.lane)
                      .map((line, i) => (
                        <path
                          key={`pass${i}`}
                          d={
                            line.endsAtNode
                              ? `M ${x(line.from)} 0 C ${x(line.from)} ${nodeY} ${x(line.to)} 0 ${x(line.to)} ${nodeY}`
                              : `M ${x(line.from)} 0 V ${rowHeight}`
                          }
                          fill="none"
                          stroke={graphColors[line.color]}
                          strokeWidth="2"
                        />
                      ))}
                    {index > 0 && graph[index - 1].lines.some((line) => !line.endsAtNode && line.to === row.lane) && (
                      <path d={`M ${x(row.lane)} 0 V ${nodeY}`} stroke={graphColors[row.color]} strokeWidth="2" />
                    )}
                    {row.lines
                      .filter((line) => line.from === row.lane)
                      .map((line, i) => (
                        <path
                          key={`parent${i}`}
                          d={`M ${x(row.lane)} ${nodeY} C ${x(row.lane)} ${rowHeight} ${x(line.to)} ${nodeY} ${x(line.to)} ${rowHeight}`}
                          fill="none"
                          stroke={graphColors[line.color]}
                          strokeWidth="2"
                        />
                      ))}
                    <circle
                      cx={x(row.lane)}
                      cy={nodeY}
                      r={commit.parents.length > 1 ? 6 : 3}
                      stroke={graphColors[row.color]}
                      fill={commit.parents.length > 1 ? 'var(--background)' : graphColors[row.color]}
                      strokeWidth="2"
                    />
                    {commit.parents.length > 1 && (
                      <path
                        d={`M ${x(row.lane) - 2.5} ${nodeY - 1} L ${x(row.lane)} ${nodeY + 1.5} L ${x(row.lane) + 2.5} ${nodeY - 1}`}
                        fill="none"
                        stroke={graphColors[row.color]}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <span className="git-commit-message">
                    {refs
                      .filter((ref) => !(ref.startsWith('origin/') && syncedBranches.has(ref.slice(7))))
                      .map((ref) => (
                        <span
                          key={ref}
                          className={`git-ref${ref.startsWith('tag: ') ? ' git-ref-tag' : ''}${syncedBranches.has(ref) ? ' git-ref-synced' : ''}${ref === activeBranch ? ' git-ref-active' : ''}`}
                          aria-label={syncedBranches.has(ref) ? `${ref}, synced with origin` : ref}
                          title={syncedBranches.has(ref) ? `${ref} · Synced with origin/${ref}` : ref}
                          style={{ color: ref.startsWith('tag: ') ? '#a17de0' : graphColors[row.color] }}
                        >
                          {ref === activeBranch && <Check size={11} aria-label="Active branch" />}
                          {ref.startsWith('tag: ') && <Tag size={10} aria-hidden="true" />}
                          {ref.startsWith('tag: ') ? ref.slice(5) : ref}
                          {syncedBranches.has(ref) && <Cloud size={11} aria-hidden="true" />}
                        </span>
                      ))}
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
      {checkoutTarget && (
        <GitDialog title="Do you want to checkout this commit?" busy={busy} onDismiss={() => setCheckoutTarget(null)}>
          <p>
            <code>{checkoutTarget.hash.slice(0, 7)}</code> · {checkoutTarget.subject}
          </p>
          <p className="git-hint">This switches to detached HEAD mode.</p>
          <div className="discard-actions">
            <Button disabled={busy} onClick={() => setCheckoutTarget(null)}>
              Cancel
            </Button>
            <Button
              className="primary"
              disabled={busy}
              onClick={() => {
                if (busy) return
                setCheckoutTarget(null)
                onCheckout(checkoutTarget.hash)
              }}
            >
              Checkout commit
            </Button>
          </div>
        </GitDialog>
      )}
      {selectedCommit && !diffClosed && (
        <CommitDiffPanel commit={selectedCommit} loadDiff={loadDiff} onClose={() => setDiffClosed(true)} />
      )}
    </section>
  )
}
