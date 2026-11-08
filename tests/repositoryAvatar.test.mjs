import assert from 'node:assert/strict'
import test from 'node:test'
import { repositoryColor, nextRepositoryColor, repositoryColors } from '../src/lib/repositoryAvatar.ts'

test('saved avatar choices survive reopen and unsupported colors fall back consistently', () => {
  const repo = { path: '/tmp/project', avatarColor: repositoryColors[0].value }
  assert.equal(repositoryColor(repo), repositoryColors[0].value)
  assert.equal(repositoryColor({ path: repo.path, avatarColor: 'invalid' }), repositoryColor({ path: repo.path }))
})

test('new repositories fill unused avatar colors before repeating', () => {
  const saved = []
  for (let i = 0; i < repositoryColors.length; i++) {
    saved.push({ path: `/tmp/${i}`, name: `${i}`, avatarColor: nextRepositoryColor(saved) })
  }
  assert.equal(new Set(saved.map((repo) => repo.avatarColor)).size, repositoryColors.length)
  assert.equal(nextRepositoryColor([]), repositoryColors[3].value)
})
