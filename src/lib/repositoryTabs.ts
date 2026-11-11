import type { GitRequest } from '../services/git.ts'
import { loadHistory, openRepository } from '../services/git.ts'

export type RepositoryTabsState = { paths: string[]; active: string | null }

export function parseRepositoryTabs(value: unknown): RepositoryTabsState {
  if (!value || typeof value !== 'object') return { paths: [], active: null }

  const state = value as Record<string, unknown>
  const paths = Array.isArray(state.paths)
    ? [...new Set(state.paths.filter((path): path is string => typeof path === 'string' && path.length > 0))]
    : []

  return { paths, active: typeof state.active === 'string' ? state.active : null }
}

export async function loadRepositoryTabs(request: GitRequest, state: RepositoryTabsState) {
  const results = await Promise.allSettled(
    state.paths.map(async (path) => {
      const repository = await openRepository(request, path)
      const history = await loadHistory(request, repository.path)

      return {
        repository,
        history,
        remote: repository.remotes.includes('origin') ? 'origin' : (repository.remotes[0] ?? ''),
        limit: 300
      }
    })
  )
  const sessions = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  const active = sessions.find((session) => session.repository.path === state.active) ?? sessions[0]

  return { sessions, active, failed: results.filter((result) => result.status === 'rejected').length }
}
