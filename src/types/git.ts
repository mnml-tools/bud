export type SavedRepository = { path: string; name: string; keyId?: string; avatarColor?: string }

export type SshKey = { id: string; name: string; path: string; hasPassword?: boolean }

export type Branch = {
  name: string
  hash: string
  remote: boolean
  current: boolean
  incomingCommits?: number
  upstreamGone?: boolean
}

export type Repository = {
  path: string
  name: string
  currentBranch: string
  dirty: boolean
  changes?: { path: string; status: string; originalPath: string | null }[]
  tags?: { name: string; hash: string }[]
  branches: Branch[]
  remotes: string[]
  outgoingCommits?: Record<string, number>
  githubRepo?: string | null
}

export type Commit = {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  date: string
  subject: string
  refs: string
}

export type History = { commits: Commit[]; hasMore: boolean }
