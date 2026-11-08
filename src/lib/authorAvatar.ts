export type GithubCommitContext = { repository: string; commit: string }

export function createGithubAvatarLookup(request: typeof fetch = fetch) {
  let limitedUntil = 0

  return async (email: string, context: GithubCommitContext): Promise<string | null> => {
    if (
      Date.now() < limitedUntil ||
      !/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(context.repository) ||
      !/^[a-f\d]{40,64}$/i.test(context.commit)
    )
      return null

    try {
      const response = await request(`https://api.github.com/repos/${context.repository}/commits/${context.commit}`, {
        headers: { Accept: 'application/vnd.github+json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(6000)
      })
      if (response.status === 403 || response.status === 429) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000
        limitedUntil = Math.max(Date.now() + 60_000, Number.isFinite(reset) ? reset : 0)
      }
      if (!response.ok) return null

      const data = await response.json()
      if (data.commit?.author?.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return null
      const url = new URL(data.author?.avatar_url ?? '')

      return url.protocol === 'https:' && ['avatars.githubusercontent.com', 'github.com'].includes(url.hostname)
        ? url.href
        : null
    } catch {
      return null
    }
  }
}

export async function authorAvatarSources(email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return []

  const sources: string[] = []
  const github = normalized.match(/^(?:(\d+)\+)?([a-z\d](?:[a-z\d-]*[a-z\d])?)@users\.noreply\.github\.com$/)
  if (github) {
    sources.push(
      github[1]
        ? `https://avatars.githubusercontent.com/u/${github[1]}?s=40&v=4`
        : `https://github.com/${github[2]}.png?size=40`
    )
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  sources.push(`https://www.gravatar.com/avatar/${hash}?s=40&d=404&r=g`)

  return sources
}

export function createAuthorAvatarResolver(
  load: (url: string) => Promise<boolean>,
  githubLookup?: (email: string, context: GithubCommitContext) => Promise<string | null>
) {
  const cache = new Map<string, { expires: number; result: Promise<string | null> }>()

  return (email: string, context?: GithubCommitContext): Promise<string | null> => {
    const normalized = email.trim().toLowerCase()
    const key = `${normalized}|${context?.repository ?? ''}`
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return cached.result

    const result = (async () => {
      try {
        const sources = await authorAvatarSources(normalized)
        const directGithub = sources.find((url) => !url.includes('gravatar.com'))
        if (directGithub && (await load(directGithub))) return directGithub

        if (context && githubLookup) {
          const url = await githubLookup(normalized, context)
          if (url && (await load(url))) return url
        }
        for (const url of sources.filter((url) => url.includes('gravatar.com'))) {
          if (await load(url)) return url
        }
      } catch {
        // Offline, unavailable hashing, and missing photos all retain local initials.
      }

      return null
    })()

    if (cache.size >= 1000) cache.delete(cache.keys().next().value!)
    cache.set(key, { expires: Date.now() + 5 * 60_000, result })

    return result
  }
}
