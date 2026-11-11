import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRepositoryTabs, parseRepositoryTabs } from '../src/lib/repositoryTabs.ts'

test('saved tabs reject malformed paths and preserve unique tab order', () => {
  assert.deepEqual(parseRepositoryTabs(null), { paths: [], active: null })
  assert.deepEqual(parseRepositoryTabs({ paths: ['/b', null, '/a', '/b', ''], active: '/a' }), {
    paths: ['/b', '/a'],
    active: '/a'
  })
})

test('restores tab order, histories, and active repository while skipping missing repositories', async () => {
  const request = async (command, args) => {
    if (args.path === '/missing') throw new Error('Missing repository')
    if (command === 'git_open') return { path: args.path, remotes: ['origin'] }
    if (command === 'git_history') return { commits: [{ hash: args.path }], hasMore: false }
    throw new Error(`Unexpected command ${command}`)
  }
  const restored = await loadRepositoryTabs(request, { paths: ['/b', '/missing', '/a'], active: '/a' })
  assert.deepEqual(
    restored.sessions.map((session) => session.repository.path),
    ['/b', '/a']
  )
  assert.equal(restored.active.repository.path, '/a')
  assert.equal(restored.active.history.commits[0].hash, '/a')
  assert.equal(restored.active.remote, 'origin')
  assert.equal(restored.failed, 1)
  const fallback = await loadRepositoryTabs(request, { paths: ['/b', '/missing'], active: '/missing' })
  assert.equal(fallback.active.repository.path, '/b')
  const empty = await loadRepositoryTabs(request, { paths: [], active: null })
  assert.equal(empty.active, undefined)
})
