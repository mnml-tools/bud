import hljs from 'highlight.js/lib/common'
import rust from 'highlight.js/lib/languages/rust'
import swift from 'highlight.js/lib/languages/swift'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import scss from 'highlight.js/lib/languages/scss'
import less from 'highlight.js/lib/languages/less'
import objectivec from 'highlight.js/lib/languages/objectivec'
import makefile from 'highlight.js/lib/languages/makefile'

hljs.registerLanguage('rust', rust)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('less', less)
hljs.registerLanguage('objectivec', objectivec)
hljs.registerLanguage('makefile', makefile)

const languages: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  py: 'python',
  rs: 'rust',
  swift: 'swift',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
  m: 'objectivec',
  mm: 'objectivec',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  vue: 'xml',
  svelte: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  jsonc: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  md: 'markdown',
  markdown: 'markdown',
  dockerfile: 'dockerfile',
  makefile: 'makefile'
}

export function diffLanguage(path: string) {
  const name = path.split('/').at(-1)?.toLowerCase() || ''
  const language = languages[name] || languages[name.split('.').at(-1) || '']

  return language && hljs.getLanguage(language) ? language : undefined
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Keep multiline tokens intact while giving every rendered line balanced markup.
function highlightLines(lines: string[], language?: string): string[] {
  if (!language || lines.join('\n').length > 200_000) return lines.map(escapeHtml)

  try {
    const html = hljs.highlight(lines.join('\n'), { language, ignoreIllegals: true }).value
    const open: string[] = []

    return html.split('\n').map((line) => {
      const prefix = open.join('')
      for (const tag of line.match(/<span\b[^>]*>|<\/span>/g) || []) {
        if (tag === '</span>') open.pop()
        else open.push(tag)
      }

      return prefix + line + '</span>'.repeat(open.length)
    })
  } catch {
    return lines.map(escapeHtml)
  }
}

export type DiffLine = { text: string; className: string; html?: string; prefix?: string }

export function highlightDiff(diff: string, path = ''): DiffLine[] {
  let language = diffLanguage(path)
  let inHunk = false
  const rows: DiffLine[] = diff.split('\n').map((text) => ({ text, className: '' }))

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    if (row.text.startsWith('diff --git ')) {
      row.className = 'file-heading'
      language = undefined
      inHunk = false
    } else if (!inHunk && /^(---|\+\+\+) /.test(row.text)) {
      row.className = 'metadata'
      const file = row.text.slice(4).replace(/\t.*$/, '')
      if (file !== '/dev/null') {
        let decoded = file
        if (file.startsWith('"')) {
          try {
            decoded = JSON.parse(file)
          } catch {
            /* Keep Git's escaped filename. */
          }
        }
        language = diffLanguage(decoded.replace(/^[ab]\//, ''))
      }
    } else if (!inHunk && row.text.startsWith('index ')) {
      row.className = 'metadata'
    } else if (row.text.startsWith('@@')) {
      row.className = 'hunk'
      inHunk = true
      const hunk: DiffLine[] = []
      let next = index + 1
      while (next < rows.length && /^[ +\-\\]/.test(rows[next].text)) hunk.push(rows[next++])
      const before = hunk.filter((line) => /^[ -]/.test(line.text))
      const after = hunk.filter((line) => /^[ +]/.test(line.text))
      const oldHtml = highlightLines(
        before.map((line) => line.text.slice(1)),
        language
      )
      const newHtml = highlightLines(
        after.map((line) => line.text.slice(1)),
        language
      )
      before.forEach((line, i) => {
        if (line.text.startsWith('-')) line.html = oldHtml[i]
      })
      after.forEach((line, i) => {
        line.html = newHtml[i]
      })
      for (const line of hunk) {
        line.className = line.text.startsWith('+') ? 'added' : line.text.startsWith('-') ? 'removed' : ''
        if (line.html !== undefined) line.prefix = line.text[0]
      }
      index = next - 1
    }
  }

  return rows
}
