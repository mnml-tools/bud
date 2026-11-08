import { useState } from 'react'
import type { MouseEvent } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { ChangedFileIcon } from '../atoms/ChangedFileIcon'
import { Button } from '../atoms/Button'
import { changeRows, changeStatus, changeColor } from '../../lib/changeFiles'
import type { ChangedFile } from '../../lib/changeFiles'

type Props = {
  files: ChangedFile[]
  staged: boolean
  tree: boolean
  selected: string[]
  busy: boolean
  onAction: (paths: string[], action: 'stage' | 'unstage') => void
  onSelect: (paths: string[], focused?: string) => void
  onMenu: (event: MouseEvent<HTMLButtonElement>, paths: string[], trigger: HTMLButtonElement) => void
}

export function ChangeFileGroup({ files, staged, tree, selected, busy, onAction, onSelect, onMenu }: Props) {
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [anchor, setAnchor] = useState('')
  const rows = changeRows(files, tree, collapsed)
  const visible = rows.filter((row) => row.kind === 'file').map((row) => row.path)
  const title = staged ? 'Staged' : 'Unstaged'
  const selectedPaths = selected.filter((path) => files.some((file) => file.path === path))

  const select = (path: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (event.shiftKey && visible.includes(anchor)) {
      const start = visible.indexOf(anchor)
      const end = visible.indexOf(path)
      onSelect(visible.slice(Math.min(start, end), Math.max(start, end) + 1), path)
    } else if (event.metaKey || event.ctrlKey) {
      const next = selected.includes(path) ? selected.filter((item) => item !== path) : [...selected, path]
      onSelect(next, next.includes(path) ? path : next.at(-1))
      setAnchor(path)
    } else {
      onSelect([path], path)
      setAnchor(path)
    }
  }

  return (
    <section className="git-change-group" aria-label={title}>
      <div className="git-change-group-heading">
        <h3>
          {title} <span>({files.length})</span>
        </h3>
        <Button
          disabled={busy || !selectedPaths.length}
          title={`${staged ? 'Unstage' : 'Stage'} ${selectedPaths.length} selected files`}
          onClick={() => onAction(selectedPaths, staged ? 'unstage' : 'stage')}
        >
          {staged ? 'Unstage' : 'Stage'}
        </Button>
      </div>
      <div
        role="listbox"
        aria-label={`${title} files`}
        aria-multiselectable="true"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            const next =
              buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]
            next?.focus()
            if (event.shiftKey && next?.dataset.path) select(next.dataset.path, event)
          }
        }}
      >
        {rows.map((row) =>
          row.kind === 'folder' ? (
            <div key={`folder:${row.path}`} role="presentation">
              <button
                className="git-change-folder"
                style={{ paddingLeft: 8 + row.depth * 14 }}
                aria-expanded={!collapsed.has(row.path)}
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(row.path)) next.delete(row.path)
                    else next.add(row.path)
                    return next
                  })
                }
              >
                {collapsed.has(row.path) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {collapsed.has(row.path) ? <Folder size={14} /> : <FolderOpen size={14} />}
                <span>{row.path.split('/').pop()}</span>
              </button>
            </div>
          ) : (
            <button
              key={row.path}
              data-path={row.path}
              className={`git-change-file ${changeColor(changeStatus(row.file, staged))}`}
              style={{ paddingLeft: 8 + row.depth * 14 + (tree ? 18 : 0) }}
              role="option"
              aria-selected={selected.includes(row.path)}
              title={row.file.originalPath ? `${row.file.originalPath} → ${row.path}` : row.path}
              onClick={(event) => select(row.path, event)}
              onContextMenu={(event) => {
                event.preventDefault()
                const paths = selected.includes(row.path) ? selected : [row.path]
                onSelect(paths, row.path)
                onMenu(event, paths, event.currentTarget)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault()
                  event.currentTarget.dispatchEvent(
                    new MouseEvent('contextmenu', {
                      bubbles: true,
                      clientX: event.currentTarget.getBoundingClientRect().left,
                      clientY: event.currentTarget.getBoundingClientRect().bottom
                    })
                  )
                }
              }}
            >
              <ChangedFileIcon path={row.path} />
              <span>{tree ? row.path.split('/').pop() : row.path}</span>
              <code>{changeStatus(row.file, staged)}</code>
            </button>
          )
        )}
      </div>
      {!files.length && <p className="git-sidebar-empty">No {title.toLowerCase()} changes.</p>}
    </section>
  )
}
