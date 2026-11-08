import { useEffect, useRef, useState } from 'react'
import type { GitRequest } from '../services/git'
import { loadHistory, openRepository } from '../services/git'
import type { History, Repository, SavedRepository, SshKey } from '../types/git'

function readSaved<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Unable to save Bud preferences; changes will last for this session only.', error)
  }
}

export function useGitWorkspace(request: GitRequest) {
  const [saved, setSaved] = useState<SavedRepository[]>(() => readSaved('bud.repositories', []))
  const [keys, setKeys] = useState<SshKey[]>(() => readSaved('bud.sshKeys', []))
  const [defaultKey, setDefaultKey] = useState<string>(() => readSaved('bud.defaultSshKey', ''))
  const [repository, setRepository] = useState<Repository | null>(null)
  const [history, setHistory] = useState<History>({ commits: [], hasMore: false })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [remote, setRemote] = useState('')
  const [openedRepositories, setOpenedRepositories] = useState<Repository[]>([])
  const sessions = useRef(
    new Map<string, { repository: Repository; history: History; remote: string; limit: number }>()
  )
  const lock = useRef(false)
  const limit = useRef(300)
  const activeSaved = saved.find((item) => item.path === repository?.path)
  const activeKeyId = activeSaved?.keyId ?? defaultKey
  const activeKey = keys.find((key) => key.id === activeKeyId)

  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(() => setNotice(''), 2500)

    return () => window.clearTimeout(timer)
  }, [notice])

  const saveSession = () => {
    if (repository) sessions.current.set(repository.path, { repository, history, remote, limit: limit.current })
  }

  const restoreSession = (path: string) => {
    const session = sessions.current.get(path)
    if (!session) return false

    setRepository(session.repository)
    setHistory(session.history)
    setRemote(session.remote)
    limit.current = session.limit
    setNotice('')
    return true
  }

  const run = async (label: string, action: () => Promise<void>) => {
    if (lock.current) return false

    lock.current = true
    setBusy(label)
    setError('')
    setNotice('')

    try {
      await action()
      return true
    } catch (error) {
      setError(String(error instanceof Error ? error.message : error))
      return false
    } finally {
      lock.current = false
      setBusy('')
    }
  }

  const remember = (repo: Repository, keyId?: string, avatarColor?: string) => {
    setSaved((previous) => {
      const existing = previous.find((item) => item.path === repo.path)
      const next = [
        {
          path: repo.path,
          name: repo.name,
          keyId: keyId ?? existing?.keyId ?? defaultKey,
          avatarColor: avatarColor ?? existing?.avatarColor
        },
        ...previous.filter((item) => item.path !== repo.path)
      ]
      persist('bud.repositories', next)
      return next
    })
  }

  const activate = async (repo: Repository, keyId?: string, avatarColor?: string) => {
    const next = await loadHistory(request, repo.path)
    saveSession()
    setOpenedRepositories((previous) =>
      previous.some((item) => item.path === repo.path) ? previous : [...previous, repo]
    )
    remember(repo, keyId, avatarColor)
    limit.current = 300
    setRepository(repo)
    setHistory(next)
    setRemote(repo.remotes.includes('origin') ? 'origin' : (repo.remotes[0] ?? ''))
  }

  const open = (path: string, avatarColor?: string) =>
    run('Opening repository', async () => {
      saveSession()
      if (restoreSession(path)) return

      await activate(await openRepository(request, path), undefined, avatarColor)
    })

  const closeTab = (path: string) => {
    if (lock.current) return

    const remaining = openedRepositories.filter((item) => item.path !== path)
    sessions.current.delete(path)
    setOpenedRepositories(remaining)
    if (repository?.path !== path) return

    const index = openedRepositories.findIndex((item) => item.path === path)
    const next = remaining[Math.min(index, remaining.length - 1)]
    if (next && restoreSession(next.path)) return

    setRepository(null)
    setHistory({ commits: [], hasMore: false })
    setNotice('')
  }

  const pick = () =>
    run('Opening repository', async () => {
      const path = await request<string | null>('git_pick_path', { file: false })
      if (path) await activate(await openRepository(request, path))
    })

  const clone = (url: string, parent: string, name: string, keyId: string, avatarColor?: string) =>
    run('Cloning repository', async () => {
      const key = keys.find((item) => item.id === keyId)
      const repo = await request<Repository>('git_clone', { url, parent, name, key: key?.path ?? null })
      await activate(repo, keyId, avatarColor)
    })

  const create = (parent: string, name: string, avatarColor: string) =>
    run('Creating repository', async () => {
      const repo = await request<Repository>('git_init', { parent, name })
      await activate(repo, undefined, avatarColor)
    })

  const refresh = () =>
    run('Refreshing', async () => {
      if (!repository) return

      const repo = await openRepository(request, repository.path)
      const next = await loadHistory(request, repo.path, limit.current)
      setRepository(repo)
      setHistory(next)
      setRemote((previous) => (repo.remotes.includes(previous) ? previous : (repo.remotes[0] ?? '')))
    })

  const more = () =>
    run('Loading history', async () => {
      if (!repository) return

      const nextLimit = limit.current + 300
      const next = await loadHistory(request, repository.path, nextLimit)
      limit.current = nextLimit
      setHistory(next)
    })

  const checkout = (branch: string) =>
    run('Switching branch', async () => {
      if (!repository) return

      const repo = await request<Repository>('git_checkout', { path: repository.path, branch })
      setRepository(repo)
      setHistory(await loadHistory(request, repo.path, limit.current))
    })

  const remoteAction = (action: 'fetch' | 'pull' | 'push') =>
    run({ fetch: 'Fetching', pull: 'Pulling', push: 'Pushing' }[action], async () => {
      if (!repository) return

      const message = await request<string>('git_remote', {
        path: repository.path,
        action,
        remote,
        key: activeKey?.path ?? null
      })
      const repo = await openRepository(request, repository.path)
      setRepository(repo)
      setHistory(await loadHistory(request, repo.path, limit.current))
      setNotice(message)
    })

  const branchAction = (branch: string, action: 'new' | 'delete' | 'merge', name?: string) =>
    run({ new: 'Creating branch', delete: 'Deleting branch', merge: 'Merging branch' }[action], async () => {
      if (!repository) return

      try {
        setRepository(
          await request<Repository>('git_branch_action', { path: repository.path, branch, action, name: name ?? null })
        )
        setHistory(await loadHistory(request, repository.path, limit.current))
      } catch (error) {
        setRepository(await openRepository(request, repository.path))
        setHistory(await loadHistory(request, repository.path, limit.current))
        throw error
      }
    })

  const chooseKey = (keyId: string) => {
    if (!repository) return

    const next = saved.map((item) => (item.path === repository.path ? { ...item, keyId } : item))
    persist('bud.repositories', next)
    setSaved(next)
  }

  const fileDiff = (file: string, staged: boolean) =>
    request<string>('git_file_diff', { path: repository!.path, file, staged })

  const imageDiff = (file: string, staged: boolean) =>
    request<{ before: string | null; after: string | null }>('git_image_diff', { path: repository!.path, file, staged })

  const commit = (message: string, description: string) =>
    run('Committing', async () => {
      if (!repository) return

      const repo = await request<Repository>('git_commit', { path: repository.path, message, description })
      setRepository(repo)
      setHistory(await loadHistory(request, repo.path, limit.current))
      setNotice('Changes committed successfully.')
    })

  const fileAction = (paths: string[], action: 'stage' | 'unstage' | 'discard') =>
    run({ stage: 'Staging files', unstage: 'Unstaging files', discard: 'Discarding changes' }[action], async () => {
      if (!repository) return

      try {
        setRepository(await request<Repository>('git_file_action', { path: repository.path, paths, action }))
      } catch (error) {
        setRepository(await openRepository(request, repository.path))
        throw error
      }
    })

  const addKey = async (name: string, path: string, password = '') => {
    if (keys.some((key) => key.path === path)) throw new Error('This key is already registered.')

    const validated = await request<string>('git_validate_key', { path })
    if (keys.some((key) => key.path === validated)) throw new Error('This key is already registered.')

    if (password) await request('git_save_key_password', { path: validated, password })

    const next = [...keys, { id: crypto.randomUUID(), name, path: validated, hasPassword: !!password }]
    persist('bud.sshKeys', next)
    setKeys(next)
  }

  const saveKeyPassword = async (id: string, password: string) => {
    const key = keys.find((item) => item.id === id)
    if (!key) throw new Error('Identity no longer exists.')

    await request('git_save_key_password', { path: key.path, password })
    const next = keys.map((item) => (item.id === id ? { ...item, hasPassword: !!password } : item))
    persist('bud.sshKeys', next)
    setKeys(next)
  }

  const setRepositoryColor = (path: string, avatarColor: string) => {
    const next = saved.map((item) => (item.path === path ? { ...item, avatarColor } : item))
    persist('bud.repositories', next)
    setSaved(next)
  }

  const removeKey = async (id: string) => {
    const key = keys.find((item) => item.id === id)
    if (key) await request('git_save_key_password', { path: key.path, password: '' })

    const next = keys.filter((key) => key.id !== id)
    const nextSaved = saved.map((item) => (item.keyId === id ? { ...item, keyId: '' } : item))
    persist('bud.sshKeys', next)
    persist('bud.repositories', nextSaved)
    setKeys(next)
    setSaved(nextSaved)
    if (defaultKey === id) changeDefaultKey('')
  }

  const changeDefaultKey = (id: string) => {
    persist('bud.defaultSshKey', id)
    setDefaultKey(id)
  }

  const forget = (path: string) => {
    const next = saved.filter((item) => item.path !== path)
    persist('bud.repositories', next)
    setSaved(next)
  }

  return {
    request,
    saved,
    openedRepositories,
    closeTab,
    keys,
    defaultKey,
    repository,
    history,
    busy,
    error,
    notice,
    remote,
    activeKeyId,
    activeKey,
    setRemote,
    open,
    pick,
    clone,
    create,
    refresh,
    more,
    checkout,
    remoteAction,
    branchAction,
    fileDiff,
    imageDiff,
    fileAction,
    commit,
    chooseKey,
    addKey,
    removeKey,
    saveKeyPassword,
    setRepositoryColor,
    changeDefaultKey,
    forget,
    close: () => {
      if (!lock.current) {
        saveSession()
        setRepository(null)
        setHistory({ commits: [], hasMore: false })
        setError('')
        setNotice('')
      }
    },
    clearError: () => setError('')
  }
}

export type GitWorkspace = ReturnType<typeof useGitWorkspace>
