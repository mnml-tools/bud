import test from 'node:test'
import assert from 'node:assert/strict'
import { branchRows } from '../src/lib/branchTree.ts'

const branch = (name) => ({ name, hash: name, remote: false, current: false })

test('groups nested branch prefixes and retains complete branch references', () => {
  const branches = ['fix/z', 'feat/ui/sidebar', 'main', 'feat/api', 'develop'].map(branch)
  const rows = branchRows(branches, new Set())

  assert.deepEqual(
    rows.map(({ kind, path, label, depth }) => [kind, path, label, depth]),
    [
      ['branch', 'main', 'main', 0],
      ['folder', 'feat', 'feat', 0],
      ['folder', 'feat/ui', 'ui', 1],
      ['branch', 'feat/ui/sidebar', 'sidebar', 2],
      ['branch', 'feat/api', 'api', 1],
      ['folder', 'fix', 'fix', 0],
      ['branch', 'fix/z', 'z', 1],
      ['branch', 'develop', 'develop', 0]
    ]
  )
  assert.equal(rows.find((row) => row.path === 'feat/ui/sidebar').branch, branches[1])
})

test('collapsing a folder hides only its descendants and search reveals matching paths', () => {
  const branches = ['feat/ui/sidebar', 'feat/ui/dialog', 'feat/api', 'fix/sidebar'].map(branch)
  const collapsed = new Set(['feat/ui'])

  assert.deepEqual(
    branchRows(branches, collapsed).map((row) => row.path),
    ['feat', 'feat/ui', 'feat/api', 'fix', 'fix/sidebar']
  )
  assert.deepEqual(
    branchRows(branches, new Set(['feat']), 'SIDEBAR').map((row) => row.path),
    ['feat', 'feat/ui', 'feat/ui/sidebar', 'fix', 'fix/sidebar']
  )
  assert.deepEqual(branchRows(branches, collapsed, 'missing'), [])
})

test('remote prefixes become folders and branches can coexist with folder names', () => {
  const branches = ['origin/main', 'origin/feat/ui'].map((name) => ({ ...branch(name), remote: true }))

  assert.deepEqual(
    branchRows(branches, new Set(['origin/feat'])).map((row) => row.path),
    ['origin', 'origin/feat', 'origin/main']
  )
  assert.equal(branchRows([branch('feat'), branch('feat/ui')], new Set()).length, 3)
})
