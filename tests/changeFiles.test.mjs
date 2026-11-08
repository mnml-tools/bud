import test from 'node:test'
import assert from 'node:assert/strict'
import { changeRows, changeStatus, changeColor } from '../src/lib/changeFiles.ts'

const file = (path, status = ' M') => ({ path, status, originalPath: null })

test('tree lists folders before files and hides descendants of collapsed folders', () => {
  const files = [file('src/lib/a.ts'), file('README.md'), file('src/main.ts'), file('assets/logo.png')]
  const rows = changeRows(files, true, new Set(['src']))
  assert.deepEqual(
    rows.map(({ kind, path, depth }) => [kind, path, depth]),
    [
      ['folder', 'assets', 0],
      ['file', 'assets/logo.png', 1],
      ['folder', 'src', 0],
      ['file', 'README.md', 0]
    ]
  )
  assert.equal(changeRows(files, true, new Set()).find((row) => row.path === 'src/lib/a.ts').depth, 2)
  assert.equal(changeRows(files, false, new Set(['src'])).length, 4)
})

test('file colors use the status for the selected side of the index', () => {
  const mixed = file('mixed.ts', 'AM')
  assert.equal(changeColor(changeStatus(mixed, true)), 'added')
  assert.equal(changeColor(changeStatus(mixed, false)), 'modified')
  assert.equal(changeColor(changeStatus(file('deleted', ' D'), false)), 'removed')
  assert.equal(changeColor(changeStatus(file('untracked', '??'), false)), 'added')
})
