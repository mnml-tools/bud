import assert from 'node:assert/strict'
import test from 'node:test'
import { diffLanguage, highlightDiff } from '../src/lib/diffHighlight.ts'

test('detects supported languages from paths and leaves unknown files plain', () => {
  assert.equal(diffLanguage('src/App.tsx'), 'typescript')
  assert.equal(diffLanguage('src/main.rs'), 'rust')
  assert.equal(diffLanguage('Dockerfile'), 'dockerfile')
  assert.equal(diffLanguage('notes.unknown'), undefined)
})

test('highlights old and new code independently while retaining change markers', () => {
  const rows = highlightDiff('@@ -1,2 +1,2 @@\n-const old = 1\n+const next = 2\n console.log("hi")', 'app.ts')
  assert.equal(rows[1].className, 'removed')
  assert.equal(rows[1].prefix, '-')
  assert.match(rows[1].html, /hljs-keyword/)
  assert.match(rows[2].html, /hljs-number/)
  assert.match(rows[3].html, /hljs-string/)
})

test('detects language independently for each file, including deleted files', () => {
  const rows = highlightDiff(
    'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -0,0 +1 @@\n+const x = 1\ndiff --git a/a.py b/a.py\n--- a/a.py\n+++ /dev/null\n@@ -1 +0,0 @@\n-def greet():\ndiff --git a/raw.xyz b/raw.xyz\n--- a/raw.xyz\n+++ b/raw.xyz\n@@ -0,0 +1 @@\n+const x = 1'
  )
  assert.match(rows[4].html, /hljs-keyword/)
  assert.match(rows[9].html, /hljs-keyword/)
  assert.equal(rows[14].html, 'const x = 1')
})

test('multiline tokens stay balanced on each diff line and source HTML is escaped', () => {
  const rows = highlightDiff('@@ -0,0 +1,3 @@\n+/* start\n+end */\n+const html = "<script>alert(1)</script>"', 'app.js')
  for (const row of rows.slice(1)) {
    assert.equal((row.html.match(/<span\b/g) || []).length, (row.html.match(/<\/span>/g) || []).length)
  }
  assert.match(rows[2].html, /hljs-comment/)
  assert.ok(!rows[3].html.includes('<script>'))
  assert.match(rows[3].html, /&lt;script&gt;/)
})

test('metadata and binary diffs remain plain text', () => {
  const rows = highlightDiff('diff --git a/a.png b/a.png\nBinary files a/a.png and b/a.png differ')
  assert.equal(rows[0].className, 'file-heading')
  assert.equal(rows[1].html, undefined)
})
