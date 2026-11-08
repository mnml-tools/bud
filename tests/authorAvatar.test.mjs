import assert from 'node:assert/strict'
import test from 'node:test'
import { authorAvatarSources, createAuthorAvatarResolver } from '../src/lib/authorAvatar.ts'

test('normalizes and hashes email addresses without exposing plaintext in avatar URLs', async () => {
  const sources = await authorAvatarSources(' MyEmailAddress@example.com ')
  assert.deepEqual(sources, [
    'https://www.gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?s=40&d=404&r=g'
  ])
  assert.deepEqual(await authorAvatarSources(''), [])
  assert.deepEqual(await authorAvatarSources('not an email'), [])
})

test('prefers GitHub identity for numeric and legacy noreply authors', async () => {
  assert.equal(
    (await authorAvatarSources('12345+Someone@users.noreply.github.com'))[0],
    'https://avatars.githubusercontent.com/u/12345?s=40&v=4'
  )
  assert.equal(
    (await authorAvatarSources('octocat@users.noreply.github.com'))[0],
    'https://github.com/octocat.png?size=40'
  )
  assert.equal((await authorAvatarSources('wrong/user@users.noreply.github.com')).length, 1)
})

test('deduplicates parallel author lookups and falls back from GitHub to Gravatar', async () => {
  const calls = []
  const resolve = createAuthorAvatarResolver(async (url) => {
    calls.push(url)
    return url.includes('gravatar.com')
  })
  const [first, second] = await Promise.all([
    resolve('octocat@users.noreply.github.com'),
    resolve(' Octocat@users.noreply.github.com ')
  ])
  assert.equal(first, second)
  assert.ok(first.includes('gravatar.com'))
  assert.equal(calls.length, 2)
})

test('missing or offline images fall back to local initials and cache the failure', async () => {
  let calls = 0
  const resolve = createAuthorAvatarResolver(async () => {
    calls++
    return false
  })
  assert.equal(await resolve('nobody@example.com'), null)
  assert.equal(await resolve('nobody@example.com'), null)
  assert.equal(calls, 1)
  const offline = createAuthorAvatarResolver(async () => {
    throw new Error('Offline')
  })
  assert.equal(await offline('nobody@example.com'), null)
})

test('regular commit emails resolve GitHub profiles using repository context', async () => {
  let lookups = 0
  const resolve = createAuthorAvatarResolver(
    async (url) => url.includes('avatars.githubusercontent.com'),
    async (email, context) => {
      lookups++
      assert.equal(email, 'person@example.com')
      assert.equal(context.repository, 'owner/project')
      return 'https://avatars.githubusercontent.com/u/123?v=4'
    }
  )
  const context = { repository: 'owner/project', commit: 'a'.repeat(40) }
  assert.equal(await resolve('person@example.com', context), 'https://avatars.githubusercontent.com/u/123?v=4')
  await resolve('person@example.com', { ...context, commit: 'b'.repeat(40) })
  assert.equal(lookups, 1)
})

test('commit lookup validates author identity and avatar origin and handles inaccessible repositories', async () => {
  const { createGithubAvatarLookup } = await import('../src/lib/authorAvatar.ts')
  const context = { repository: 'owner/project', commit: 'a'.repeat(40) }
  const response = (email, avatar) =>
    new Response(JSON.stringify({ commit: { author: { email } }, author: { avatar_url: avatar } }))
  const lookup = createGithubAvatarLookup(async () =>
    response('person@example.com', 'https://avatars.githubusercontent.com/u/123')
  )
  assert.equal(await lookup('person@example.com', context), 'https://avatars.githubusercontent.com/u/123')
  assert.equal(await lookup('another@example.com', context), null)
  const untrusted = createGithubAvatarLookup(async () => response('person@example.com', 'https://example.com/photo'))
  assert.equal(await untrusted('person@example.com', context), null)
  const privateRepo = createGithubAvatarLookup(async () => new Response('', { status: 404 }))
  assert.equal(await privateRepo('person@example.com', context), null)
  let requests = 0
  const rateLimited = createGithubAvatarLookup(async () => {
    requests++
    return new Response('', { status: 403 })
  })
  await rateLimited('person@example.com', context)
  await rateLimited('person@example.com', context)
  assert.equal(requests, 1)
})
