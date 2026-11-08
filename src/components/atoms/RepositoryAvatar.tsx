import type { CSSProperties } from 'react'
import { repositoryColor } from '../../lib/repositoryAvatar'
import type { SavedRepository } from '../../types/git'

export function RepositoryAvatar({
  repository
}: {
  repository: Pick<SavedRepository, 'path' | 'name' | 'avatarColor'>
}) {
  return (
    <span
      className="avatar avatar-normal"
      style={{ '--avatar-color': repositoryColor(repository) } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from(repository.name.trim())[0]?.toLocaleUpperCase() ?? '?'}
    </span>
  )
}
