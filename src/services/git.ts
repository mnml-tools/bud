import { invoke, isTauri } from '@tauri-apps/api/core'
import type { History, Repository } from '../types/git'

export type GitRequest = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

export const gitRequest: GitRequest = (command, args) => {
  if (!isTauri()) return Promise.reject(new Error('Open Bud as a desktop app to access local repositories.'))

  return invoke(command, args)
}

export const openRepository = (request: GitRequest, path: string) => request<Repository>('git_open', { path })

export const loadHistory = (request: GitRequest, path: string, limit = 300) =>
  request<History>('git_history', { path, limit })
