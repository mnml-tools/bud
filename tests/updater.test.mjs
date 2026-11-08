import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createManifest } from '../scripts/create-update-manifest.mjs'
import { registerUpdateGuard, inspectUpdateSafety, updateDecision } from '../src/services/updateGuard.ts'

test('update guard reads live dirty and busy state and cleans up safely', () => {
  let state = { dirty: true, busy: false }
  const cleanup = registerUpdateGuard(() => state)
  assert.deepEqual(inspectUpdateSafety(), state)
  state = { dirty: false, busy: true }
  assert.deepEqual(inspectUpdateSafety(), state)
  const newer = registerUpdateGuard(() => ({ dirty: true, busy: true }))
  cleanup()
  assert.equal(inspectUpdateSafety().dirty, true)
  newer()
  assert.deepEqual(inspectUpdateSafety(), { dirty: false, busy: false })
})

test('manifest includes both universal Mac architectures and requires matching tags and signatures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bud-updater-'))
  try {
    for (const file of ['Bud.AppImage', 'Bud.app.tar.gz']) {
      writeFileSync(join(directory, file), '')
      writeFileSync(join(directory, `${file}.sig`), 'signed-artifact\n')
    }
    const manifest = createManifest(directory, 'mnml-tools/bud', 'v0.4.0', '0.4.0')
    assert.deepEqual(Object.keys(manifest.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64'])
    assert.equal(manifest.platforms['darwin-aarch64'].url, manifest.platforms['darwin-x86_64'].url)
    assert.equal(manifest.platforms['linux-x86_64'].signature, 'signed-artifact')
    assert.throws(() => createManifest(directory, 'mnml-tools/bud', 'v0.5.0', '0.4.0'), /does not match/)
    rmSync(join(directory, 'Bud.AppImage.sig'))
    assert.throws(() => createManifest(directory, 'mnml-tools/bud', 'v0.4.0', '0.4.0'), /ENOENT/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('installation requires discard confirmation and rechecks busy work even after confirmation', () => {
  assert.equal(updateDecision({ dirty: false, busy: false }, false, false), 'install')
  assert.equal(updateDecision({ dirty: true, busy: false }, false, false), 'confirm')
  assert.equal(updateDecision({ dirty: true, busy: false }, true, false), 'install')
  assert.equal(updateDecision({ dirty: true, busy: true }, true, false), 'busy')
  assert.equal(updateDecision({ dirty: false, busy: true }, false, false), 'busy')
  assert.equal(updateDecision({ dirty: true, busy: false }, false, true), 'install')
})
