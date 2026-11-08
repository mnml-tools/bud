import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { List, ListTree } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { useChangesSplitResize } from '../../hooks/useChangesSplitResize'
import { useShortcut } from '../../hooks/useShortcut'
import { selectAllFilesShortcut } from '../../lib/shortcuts'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { SidebarResizeHandle } from '../molecules/SidebarResizeHandle'
import { ChangeFileGroup } from './ChangeFileGroup'
import { ChangeDiffPane } from './ChangeDiffPane'
import { ImageDiffPane } from './ImageDiffPane'
import { CommitForm } from './CommitForm'
import { ChangeContextMenu } from '../molecules/ChangeContextMenu'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'

type Selection = { staged: boolean; paths: string[]; focused?: string }
type Menu = { x: number; y: number; staged: boolean; paths: string[]; trigger: HTMLButtonElement }

export function RepositoryChanges({ workspace }: { workspace: GitWorkspace }) {
  const repository = workspace.repository!
  const split = useChangesSplitResize()
  const resize = useSidebarResize({
    storageKey: 'bud.changesSidebarWidth.v2',
    initial: 300,
    minimum: 160,
    maximum: 300
  })
  const changes = repository.changes ?? []
  const [tree, setTree] = useState(true)
  const [selection, setSelection] = useState<Selection>({ staged: false, paths: [] })
  const [menu, setMenu] = useState<Menu | null>(null)
  const [discard, setDiscard] = useState<string[] | null>(null)
  const [preview, setPreview] = useState({ diff: '', error: '', loading: false, path: '', staged: false })
  const diffRequest = useRef(workspace.fileDiff)
  diffRequest.current = workspace.fileDiff
  const dismissMenu = useCallback(() => setMenu(null), [])
  const groups = [
    { staged: false, files: changes.filter((file) => file.status === '??' || file.status[1] !== ' ') },
    { staged: true, files: changes.filter((file) => file.status !== '??' && file.status[0] !== ' ') }
  ]
  const focused = groups
    .find((group) => group.staged === selection.staged)
    ?.files.find((file) => file.path === selection.focused)?.path
  const isImage = !!focused && /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i.test(focused)

  const activeFiles = groups.find((group) => group.staged === selection.staged)!.files
  useShortcut(selectAllFilesShortcut, !menu && activeFiles.some((file) => selection.paths.includes(file.path)), () => {
    setSelection({
      staged: selection.staged,
      paths: activeFiles.map((file) => file.path),
      focused: focused ?? activeFiles[0]?.path
    })
  })

  useEffect(() => {
    let cancelled = false
    if (!focused || isImage) {
      setPreview({ diff: '', error: '', loading: false, path: '', staged: selection.staged })
      return
    }

    setPreview({ diff: '', error: '', loading: true, path: focused, staged: selection.staged })
    diffRequest.current(focused, selection.staged).then(
      (diff) => {
        if (!cancelled) setPreview({ diff, error: '', loading: false, path: focused, staged: selection.staged })
      },
      (error) => {
        if (!cancelled)
          setPreview({ diff: '', error: String(error), loading: false, path: focused, staged: selection.staged })
      }
    )
    return () => {
      cancelled = true
    }
  }, [repository, focused, selection.staged, isImage])

  const act = async (paths: string[], action: 'stage' | 'unstage' | 'discard') => {
    if (await workspace.fileAction(paths, action)) {
      setSelection({ staged: false, paths: [] })
      setDiscard(null)
    }
  }

  return (
    <div className="git-changes-pane" aria-label="All changes">
      <div id="changes-sidebar" className="git-change-list-pane" style={{ width: resize.width }}>
        <div className="git-changes-heading">
          <h2>All changes ({changes.length})</h2>
          <div className="git-changes-view" role="group" aria-label="File view">
            <Button aria-label="Tree view" title="Tree view" aria-pressed={tree} onClick={() => setTree(true)}>
              <ListTree size={14} />
            </Button>
            <Button aria-label="Inline view" title="Inline view" aria-pressed={!tree} onClick={() => setTree(false)}>
              <List size={14} />
            </Button>
          </div>
        </div>
        <div
          ref={split.container}
          className="git-change-groups"
          style={{ gridTemplateRows: `minmax(0, ${split.ratio}fr) 5px minmax(0, ${100 - split.ratio}fr)` }}
        >
          {groups.map(({ staged, files }) => (
            <Fragment key={String(staged)}>
              {staged && (
                <div
                  className={`git-changes-resizer${split.dragging ? ' dragging' : ''}`}
                  role="separator"
                  aria-label="Resize unstaged and staged sections"
                  aria-orientation="horizontal"
                  aria-valuemin={10}
                  aria-valuemax={90}
                  aria-valuenow={Math.round(split.ratio)}
                  aria-valuetext={`${Math.round(split.ratio)}% unstaged, ${Math.round(100 - split.ratio)}% staged`}
                  tabIndex={0}
                  onDoubleClick={split.reset}
                  {...split.handlers}
                />
              )}
              <ChangeFileGroup
                key={String(staged)}
                files={files}
                staged={staged}
                tree={tree}
                selected={selection.staged === staged ? selection.paths : []}
                busy={!!workspace.busy}
                onAction={(paths, action) => void act(paths, action)}
                onSelect={(paths, focused) => setSelection({ staged, paths, focused })}
                onMenu={(event, paths, trigger) =>
                  setMenu({ x: event.clientX, y: event.clientY, paths, staged, trigger })
                }
              />
            </Fragment>
          ))}
        </div>
        <SidebarResizeHandle {...resize} label="Resize changes sidebar" controls="changes-sidebar" />
      </div>
      <div className="git-changes-detail-pane">
        {isImage && focused ? (
          <ImageDiffPane
            key={`${selection.staged}:${focused}`}
            workspace={workspace}
            path={focused}
            staged={selection.staged}
          />
        ) : (
          <ChangeDiffPane
            path={focused}
            staged={selection.staged}
            diff={preview.path === focused && preview.staged === selection.staged ? preview.diff : ''}
            loading={!!focused && (preview.path !== focused || preview.staged !== selection.staged || preview.loading)}
            error={preview.path === focused && preview.staged === selection.staged ? preview.error : ''}
          />
        )}
        <CommitForm workspace={workspace} />
      </div>
      {menu && (
        <ChangeContextMenu
          {...menu}
          count={menu.paths.length}
          busy={!!workspace.busy}
          onDismiss={dismissMenu}
          onAction={(action) => {
            setMenu(null)
            if (action === 'discard') setDiscard(menu.paths)
            else void act(menu.paths, action)
          }}
        />
      )}
      {discard && (
        <GitDialog title="Discard changes?" busy={!!workspace.busy} onDismiss={() => setDiscard(null)}>
          <p>
            Discard all staged and unstaged changes to {discard.length} selected{' '}
            {discard.length === 1 ? 'file' : 'files'}? Untracked files will be deleted. This cannot be undone.
          </p>
          <ul className="git-discard-files">
            {discard.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
          <div className="discard-actions">
            <Button disabled={!!workspace.busy} onClick={() => setDiscard(null)}>
              Cancel
            </Button>
            <Button
              className="git-discard-action"
              disabled={!!workspace.busy}
              onClick={() => void act(discard, 'discard')}
            >
              Discard changes
            </Button>
          </div>
        </GitDialog>
      )}
    </div>
  )
}
