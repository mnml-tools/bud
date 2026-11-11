import { useId, useMemo } from 'react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { RepositorySelectorMenu } from '../molecules/RepositorySelectorMenu'

export function RepositorySwitcher({
  workspace,
  onDismiss,
  onOpenLocal,
  onClone
}: {
  workspace: GitWorkspace
  onDismiss: () => void
  onOpenLocal: () => void
  onClone: () => void
}) {
  const id = useId()
  const repositories = useMemo(() => {
    const all = new Map([...workspace.openedRepositories, ...workspace.saved].map((repo) => [repo.path, repo]))

    return [...all.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [workspace.openedRepositories, workspace.saved])

  return (
    <RepositorySelectorMenu
      id={id}
      repository={{ path: '', name: '' }}
      repositories={repositories}
      label="Switch repository"
      emptyMessage="No saved repositories yet."
      onDismiss={onDismiss}
      onSelect={(repo) => void workspace.open(repo.path)}
      onOpenLocal={onOpenLocal}
      onClone={onClone}
    />
  )
}
