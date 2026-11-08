// UI-only fixture: every native command is simulated; no user repositories or keys are accessed.
import { createRoot } from 'react-dom/client'
import { App } from '../src/app/App'
import type { GitRequest } from '../src/services/git'
import type { Repository, Commit } from '../src/types/git'
import '../src/style.css'

// Optional live regression check for regular-email authors; only reads this public sample repository.
const githubSample = new URLSearchParams(location.search).has('github')
  ? await fetch('https://api.github.com/repos/octocat/Hello-World/commits/master').then((response) => response.json())
  : null

const hash = (index: number) => index.toString(16).padStart(40, '0')
const commits: Commit[] = Array.from({ length: 650 }, (_, index) => ({
  hash: hash(1000 - index),
  parents: index === 649 ? [] : index === 0 ? [hash(999), hash(998)] : index === 1 ? [hash(997)] : [hash(999 - index)],
  author: index % 3 === 0 ? 'Octocat' : 'Alex Morgan',
  authorEmail: index % 3 === 0 ? 'octocat@users.noreply.github.com' : 'alex@example.test',
  date: new Date(Date.UTC(2026, 10, 7) - index * 3600000).toISOString(),
  subject: [
    'Merge branch feature/repository-workspace',
    'Add SSH identity picker',
    'Build commit graph renderer',
    'Keep appearance preferences',
    'Improve repository navigation'
  ][index % 5],
  refs:
    index === 0
      ? 'HEAD -> main, origin/main'
      : index === 1
        ? 'feature/ssh-identities'
        : index === 2
          ? 'origin/feature/commit-graph'
          : ''
}))
if (githubSample?.sha)
  commits.splice(0, commits.length, {
    hash: githubSample.sha,
    parents: githubSample.parents.map((parent: { sha: string }) => parent.sha),
    author: githubSample.commit.author.name,
    authorEmail: githubSample.commit.author.email,
    date: githubSample.commit.author.date,
    subject: githubSample.commit.message.split('\n')[0],
    refs: 'HEAD -> master'
  })

const repository: Repository = {
  path: '/tmp/bud-fixture/project',
  name: 'bud',
  currentBranch: 'main',
  dirty: new URLSearchParams(location.search).has('changes'),
  changes: new URLSearchParams(location.search).has('changes')
    ? [
        { path: 'src/app/App.tsx', status: ' M', originalPath: null },
        { path: 'src/components/Button.tsx', status: 'MM', originalPath: null },
        { path: 'src/style.css', status: ' M', originalPath: null },
        { path: 'assets/logo.svg', status: '??', originalPath: null },
        { path: 'docs/old.md', status: ' D', originalPath: null },
        { path: 'package.json', status: 'M ', originalPath: null },
        { path: 'tests/new.test.mjs', status: 'A ', originalPath: null }
      ]
    : [],
  branches: [
    { name: 'main', hash: hash(1000), current: true, remote: false },
    { name: 'feature/ssh-identities', hash: hash(999), current: false, remote: false },
    { name: 'origin/main', hash: hash(1000), current: false, remote: true },
    { name: 'origin/feature/commit-graph', hash: hash(998), current: false, remote: true }
  ],
  githubRepo: githubSample ? 'octocat/Hello-World' : undefined,
  remotes: ['origin']
}
const passwords = new Map<string, boolean>()
const repositories = new Map<string, Repository>([[repository.path, repository]])

function fixtureRepository(path: string, empty = false): Repository {
  const existing = repositories.get(path)
  if (existing) return existing

  const value = {
    ...repository,
    path,
    name: path.split('/').pop() ?? 'Project',
    branches: empty ? [] : repository.branches,
    remotes: empty ? [] : repository.remotes
  }
  repositories.set(path, value)
  return value
}

const request: GitRequest = async <T,>(command: string, args?: Record<string, unknown>) => {
  if (command === 'git_pick_path') return (args?.file ? '/tmp/bud-fixture/id_personal' : repository.path) as T
  if (command === 'git_save_key_password') {
    passwords.set(String(args!.path), !!args!.password)
    return undefined as T
  }
  if (command === 'git_key_password_status') return (passwords.get(String(args!.path)) ?? false) as T
  if (command === 'git_init') return fixtureRepository(`${args!.parent}/${args!.name}`, true) as T
  if (command === 'git_validate_key') return args!.path as T
  if (command === 'git_open') return fixtureRepository(String(args!.path)) as T
  if (command === 'git_clone') return fixtureRepository(`${args!.parent}/${args!.name}`) as T
  if (command === 'git_history' && !fixtureRepository(String(args!.path)).branches.length)
    return { commits: [], hasMore: false } as T
  if (command === 'git_history')
    return { commits: commits.slice(0, Number(args?.limit)), hasMore: Number(args?.limit) < commits.length } as T
  if (command === 'git_file_diff')
    return `diff --git a/${args!.file} b/${args!.file}\n--- a/${args!.file}\n+++ b/${args!.file}\n@@ -1,3 +1,3 @@\n export function Example() {\n-  return 'before'\n+  return '${args!.staged ? 'staged' : 'working tree'}'\n }\n` as T
  if (command === 'git_file_action') {
    const repo = fixtureRepository(String(args!.path))
    const paths = args!.paths as string[]
    const changes = (repo.changes ?? []).flatMap((file) => {
      if (!paths.includes(file.path)) return [file]
      if (args!.action === 'discard') return []
      const status = args!.action === 'stage' ? `${file.status === '??' ? 'A' : file.status[1]} ` : ` ${file.status[0]}`
      return [{ ...file, status }]
    })
    const updated = { ...repo, changes, dirty: changes.length > 0 }
    repositories.set(repo.path, updated)
    return updated as T
  }
  if (command === 'git_remote') return 'Fixture remote action complete.' as T
  if (command === 'git_checkout') {
    repository.currentBranch = String(args!.branch)
    repository.branches = repository.branches.map((branch) => ({
      ...branch,
      current: !branch.remote && branch.name === args!.branch
    }))
    return { ...repository } as T
  }
  throw new Error(`Unsupported fixture command: ${command}`)
}

createRoot(document.getElementById('root')!).render(<App request={request} />)
