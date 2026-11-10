import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesShortcut, switchRepositoryShortcut, openRepositoryShortcut } from '../src/lib/shortcuts.ts'
import {
  getShortcuts,
  readShortcutOverrides,
  resetShortcuts,
  resolveShortcut,
  saveShortcut,
  subscribeShortcuts
} from '../src/services/shortcutPreferences.ts'

test('shortcut preferences persist, resolve live, reject conflicts and reset safely', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
      getItem: (key) => values.get(key) ?? null
    }
  })
  let updates = 0
  const unsubscribe = subscribeShortcuts(() => updates++)
  try {
    const custom = { key: 'j', primary: true, shift: true, alt: false, allowInInputs: false }
    saveShortcut('switchRepository', custom)
    const binding = resolveShortcut(switchRepositoryShortcut)
    assert.equal(binding.key, 'j')
    assert.equal(binding.allowInInputs, true)
    assert.ok(
      matchesShortcut({ key: 'J', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false }, binding, true)
    )
    assert.equal(readShortcutOverrides(values.get('bud.shortcuts')).switchRepository.key, 'j')
    assert.throws(() => saveShortcut('openRepository', custom), /Switch repository/)
    assert.equal(resolveShortcut(openRepositoryShortcut), openRepositoryShortcut)
    for (const key of ['Tab', 'Escape', 'Shift'])
      assert.throws(() => saveShortcut('settings', { ...custom, key }), /reserved/)
    assert.throws(() => saveShortcut('settings', { ...custom, primary: false }), /Command/)
    saveShortcut('switchRepository')
    assert.equal(resolveShortcut(switchRepositoryShortcut), switchRepositoryShortcut)
    saveShortcut('switchRepository', custom)
    resetShortcuts()
    assert.deepEqual(getShortcuts(), {})
    assert.equal(values.has('bud.shortcuts'), false)
    assert.equal(updates, 4)
    globalThis.localStorage.setItem = () => {
      throw new Error('Storage unavailable')
    }
    assert.throws(() => saveShortcut('switchRepository', custom), /Storage unavailable/)
    assert.equal(resolveShortcut(switchRepositoryShortcut), switchRepositoryShortcut)
  } finally {
    unsubscribe()
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('invalid or conflicting persisted shortcuts fall back to defaults', () => {
  assert.deepEqual(readShortcutOverrides('{broken'), {})
  assert.deepEqual(readShortcutOverrides('{"settings":{"key":"Tab","primary":true,"shift":false,"alt":false}}'), {})
  assert.deepEqual(readShortcutOverrides('{"settings":{"key":"p","primary":true,"shift":false,"alt":false}}'), {})
})
