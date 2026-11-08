import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { resolveAuthorAvatar } from '../../services/authorAvatar'
import { repositoryColor } from '../../lib/repositoryAvatar'

export function AuthorAvatar({
  name,
  email = '',
  githubRepo,
  commit
}: {
  name: string
  email?: string
  githubRepo?: string
  commit?: string
}) {
  const [photo, setPhoto] = useState<{ email: string; url: string } | null>(null)
  const url = photo?.email === email ? photo.url : null

  useEffect(() => {
    let disposed = false
    void resolveAuthorAvatar(email, githubRepo && commit ? { repository: githubRepo, commit } : undefined).then(
      (url) => {
        if (!disposed) setPhoto(url ? { email, url } : null)
      }
    )

    return () => {
      disposed = true
    }
  }, [email, githubRepo, commit])

  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    words.length > 1
      ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`
      : Array.from(words[0] ?? '?')
          .slice(0, 2)
          .join('')

  return (
    <span
      className="avatar avatar-small git-author-avatar"
      style={
        {
          '--avatar-color': repositoryColor({ path: email.trim().toLowerCase() || name.trim().toLocaleLowerCase() })
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setPhoto(null)} />
      ) : (
        initials.toLocaleUpperCase()
      )}
    </span>
  )
}
